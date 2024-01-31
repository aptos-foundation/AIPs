---
aip: 61
title: OpenID blockchain (OIDB) accounts
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/297
Status: Draft
last-call-end-date (*optional): 02/15/2024
type: <Standard (Core, Framework)>
created: 01/04/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-61 - OpenID blockchain (OIDB) accounts

## Summary

 >  Summarize in 3-5 sentences what is the problem we’re solving for and how are we solving for it

Currently, the only way[^multisig] to secure your Aptos account is to protect the **secret key (SK)** associated with it. Unfortunately, this is much easier said than done. In reality, secret keys are often *lost* (e.g., users forget to write down their mnemonic when first setting up their Aptos wallet) or *stolen* (e.g., users are tricked into revealing their SK). This makes onboarding users unnecessarily difficult and drives users away when their accounts are lost or stolen.

In this AIP, we describe a more user-friendly approach for account management that relies on the **OpenID Connect (OIDC)** standard and recent developments in **zero-knowledge proofs of knowledge (ZKPoKs)** of **OIDC signatures**[^snark-jwt-verify]$^,$[^nozee]$^,$[^bonsay-pay]$^,$[^zk-blind]$^,$[^zklogin].

Specifically, we enable **OpenID blockchain (OIDB) accounts** on Aptos that are secured through the owner’s existing **OIDC account** (i.e., their Web2 account with an **OIDC provider** such as Google, GitHub or Apple), rather than through a difficult-to-manage secret key. In a nutshell, _“your blockchain account = your OIDC account”_.

A key property of OIDB accounts is that they are not only *bound* to the user’s OIDC account (e.g., `alice@gmail.com`) but are also bound to a **managing application** registered with the OIDC provider (e.g., a dapp’s `dapp.xyz` website, or a wallet’s mobile phone app). In other words, they are **application-specific** accounts. As a consequence, if the managing application of an account disappears or loses their OIDC provider registration credentials, then users whose accounts are bound to this application will become inaccessible, unless alternative **recovery paths** are provided (discussed below).

### Goals

 > What are the goals and what is in scope? Any metrics?
 > Discuss the business impact and business value this change would impact

1. **User-friendliness:**
   1. Blockchain accounts should be backed by user-friendly OIDC accounts, which makes them easy-to-access (and thus hard-to-lose-access)
   2. Enable users to interact with dapps via their OIDC accounts, without having to install a wallet: i.e., a **walletless experience**.
   3. Enable users to easily-access their blockchain account from any device

2. **Security:**
   1. OIDB accounts should be as secure as OIDC accounts
   2. OIDB accounts should be recoverable if the managing applications disappears (see alternative recovery paths discussion below)

3. **Privacy**: 
   1. OIDB accounts and their associated transactions should **not** leak any information about the user’s OIDC account (e.g., a Google user’s email address or their OAuth `sub` identifier).
   2. The OIDC provider (e.g., Google) should not be able to track the user’s transaction activity.
   3. OIDB blockchain accounts for the same user but with different managing applications should not be linkable on chain.
4. **Efficiency**: Transactions for OIDB accounts should be efficient to create by wallets/dapps (< 1 second) and efficient to validate by Aptos validators (< 2 milliseconds).
5. **Censorship-resistance:** Aptos validators should not be able to give preferential treatment to OpenID transactions based on the identity of the managing application or user.
6. **Decentralization**: OIDB accounts should not require the existence of parties that can never be decentralized.

### Background

#### OAuth and OpenID Connect (OIDC)

We assume the reader is familiar with the OAuth authorization framework[^HPL23] and the OIDC protocol[^oidc]:

- The security of the OAuth **implicit grant flow** and the OAuth **authorization code grant flow**.
- OAuth client registration (e.g., the `client_id` of a managing applications)
- **JSON Web Tokens (JWTs)**, which consist of a 
  - JWT **header**
  - JWT **payload**, which we often refer to simply as “the **JWT**.”
  - JWT **signature**, over the header and payload, which we often refer to as an **OIDC signature**
  - We often refer to the combination of the header, payload and their signature as a **signed JWT**.
  - See [an example here](#JWT-header-and-payload-example).
- Relevant JWT header fields (e.g., `kid`)
- Relevant JWT payload fields (e.g., `aud`, `sub`, `iss`, `email_verified`, `nonce`)
- **JSON Web Keys (JWKs)**, which are published by each OIDC provider at a JWK endpoint URL indicated in their OpenID configuration URL

#### Terminology

- **OIDC account**: A Web2 account with an OIDC provider such as Google (e.g., `alice@gmail.com`)
- **OIDB account**: An OpenID blockchain (OIDB) account whose security and liveness is backed by an OIDC account (e.g., a Google account) rather than a secret key. The heart of this AIP is to explain how such OIDB accounts can be safely implemented.
- **Application-specific [OIDB] accounts**: An OIDB account is **bound** both the user’s identity (e.g., `alice@gmail.com` and the managing application’s identity (e.g., `dapp.xyz`). This means that, in order to access the account, a signed JWT token over that user’s identity and over the managing application’s identity must be exhibited. Such a token can only be obtained through signing in the managing application via the user’s OIDC provider (e.g., Google). This has [important implications](#alternative-recovery-paths-for-when-managing-applications-disappear).

#### tl;dr on OIDC

For the purposes of this AIP, the most important thing to understand about OIDC is that it enables a **managing application** (e.g., `dapp.xyz` or `some-wallet.org` or a mobile phone app) to sign in its users via their OIDC provider (e.g, Google) without learning that user’s OIDC credentials (i.e., Google account password). Importantly, if (and only if) the user successfully logs in, then **only** the managing application (and no one else) receives a **signed JWT** from Google as a publicly-verifiable proof of the user having logged in.

The purpose of this AIP will be to demonstrate how this signed JWT can be used to authorize transactions for an OIDB account associated with that user *and* managing application.

#### Zero-knowledge proofs

We assume familiarity with zero-knowledge proof (ZKP) systems: i.e., a ZKP system for a **relation** $R$ allows a **prover** to convince a **verifier**, who has a **public input** $x$,  that the prover knows a **private input** $w$ such that $R(x; w) = 1$ (i.e., “it holds”) without leaking any information about $w$ to the verifier, beyond the fact that the relation holds.

Other ZKP terms:

- **Proving key** and **verification key**
- **Relation-specific trusted setup**

#### Aptos accounts and transaction validation

Recall that in Aptos, an account is identified by its **address**, under which the account’s **authentication key** is stored. 

The authentication key is a cryptographically-binding commitment to the account’s **public key (PK)** (e.g., a hash of the PK).

Naturally, the **owning user** of the account will manage the corresponding **secret key**.

To **authorize** access to an Aptos account, a transaction includes:

1. A **digital signature** over (a) the *address* of the account and (b) the **transaction payload** (e.g., a Move entry function call)
2. The *public key* committed in the *authentication key* under the account’s *address*

To **verify the transaction** is authorized to access the account, the validators do the following:

1. They fetch the *public key* from the transaction and <u>derive</u> its expected *authentication key*, depending on its type
2. They check that this <u>derived</u> expected *authentication key* equals the *authentication key* stored under the address
3. They check that the *signature* verifies under the fetched *public key* over the transaction

### Scope

This AIP is concerned with:

1. Explaining the intricacies of how OIDB accounts work
2. Describing our initial Rust implementation of the OIDB transaction authenticator

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

1. Security of DNS and X.509 certificate ecosystem
   - OIDB accounts rely on OAuth and OIDC, whose security in turn relies on the security of DNS and the X.509 certificate ecosystem.
   - So does all the software on the Internet, so we consider this out-of-scope
2. Malicious wallet applications that impersonate a genuine wallet application
   - We assume an attacker is **not** able to publish a mobile phone app in (say) Apple’s App Store that impersonates a wallet’s registered OAuth `client_id`
   - We assume an attacker is **not** able to trick a user into installing a malicious desktop app that impersonates another app’s OAuth `client_id`. For this reason, we do **not** recommend managing applications for OIDB accounts that are desktop apps, since they are very easy to impersonate.
3. In-depth discussion of auxiliary backend components necessary for OIDB accounts:
   - **Pepper service**: will be the scope of a future AIP (see [the appendix](#pepper-service))
   - **ZK proving service**: will be the scope of a future AIP (see [the appendix](#(oblivious)-zk-proving-service))
   - **Consensus on JSON Web Keys (JWKs)**: will be the scope of a future AIP (see [the appendix](#jwk-consensus))
   - **Trusted setup MPC ceremony** for our Groth16 ZKP (see [Groth16 discussion](#choice-of-zkp-system-groth16))
4. Decentralization plans for the pepper and ZK proving service

## Motivation

 > Describe the impetus for this change. What does it accomplish?

As explained in the summary, this change accomplishes two things:

1.  Makes it much easier for users to onboard, by simply signing in with (say) their Google account into a wallet or dapp.
2.  Makes it much harder for users to lose their accounts, since there are no secret keys involved.

 > What might occur if we do not accept this proposal?

Not accepting this proposal would maintain the status quo of user-unfriendly account management based on secret keys. It would thus likely inhibit adoption of the Aptos network, since not many users understand the intricacies of public-key cryptography (e..g, how to secure their mnemonic, what is a secret key, or how is a public key different than a secret key).

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?

1. Dapp developers
   - Familiarize themselves with the SDK for OIDB accounts
   - If desired, dapps can enable a **walletless experience** where users can sign in to the dapp directly via their OpenID account (e.g., their Google account) without connecting a wallet.
   - This will give the user access to their **dapp-specific blockchain account** for that dapp. This way, since this account is scoped only to that dapp, the dapp can authorize transactions “blindly” on the user’s behalf, without complicated TXN prompts.
2. Wallet developers
   - Familiarize themselves with the SDK for OIDB accounts
   - Consider switching their default user onboarding flow to use OIDB accounts
3. Users
   - Familiarize themselves with the security model of OIDB accounts
   - Understand their account would be as secure as their OpenID accounts (e.g., their Google account)
   - Understand how to use alternative _recovery paths_, should the managing application become unavailable

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

### Passkeys

An alternative solution that precludes the need for users to manage their own secret keys are **passkeys** and the **WebAuthn standard** built around them. A passkey is a secret key associated with an application or website that is backed up in the user’s cloud (e.g., Apple’s iCloud, Google’s Password Manager, etc.)

Passkeys were originally introduced as a way of replacing passwords for websites, by having a website associate each user with their passkey public key, rather than their password. Then, a user can securely authenticate themselves to the website by signing a random challenge using their corresponding passkey secret key, which is safely backed up in their cloud.

A natural inclination is to leverage passkeys for blockchain accounts, by setting the account’s secret key to be a passkey secret key. Unfortunately, passkeys are not sufficiently mature yet to support this use case. Specifically, **passkeys are not always backed up to the cloud** on some platforms (e.g., Microsoft Windows). Furthermore, passkeys introduce a **cross-device problem**: if a user creates a blockchain account on their Apple phone, their passkey secret key is backed up to iCloud, which will not be accessible from that user’s other Android device, Linux device or Windows device, since support for cross-platform backup of passkeys is not yet implemented.

### Multi-party computation (MPC)

An alternative solution that precludes the need for users to manage their own secret keys is to rely on a **multi-party computation (MPC)** service to compute signatures for users after they have been authenticated **somehow**.

Typically, users must authenticate themselves to the MPC in a user-friendly manner (i.e., without managing SKs). Otherwise, the MPC system does not solve any UX problem and is useless. As a result, most MPC systems use either OIDC or passkeys to authenticate users before signing on their behalf. 

This has two problems. First, the MPC system will learn who is transacting and when: i.e., the OIDC accounts and their corresponding on-chain account addresses.

Second, the MPC is superfluous since users can be authenticated directly to the validators via OIDC (as argued in this AIP) or via passkeys (as argued [above](#passkeys)).

Put differently, **OIDB accounts sidestep the need for a complex MPC signing service** (which can be tricky to implement securely and robustly) by directly authenticating users via OIDC. At the same time OIDB accounts are as secure as MPC-based accounts, since they both bootstrap security from OIDC.

Nonetheless, OIDB accounts still rely on a distributed pepper service and a ZK proving service (see [the appendix](#appendix)). However:

- The proving service is needed only for performance when computing ZKPs in the browser or on phones and stands to be removed in the future when the ZKP system is optimized.
- The pepper service, unlike the MPC service, is not sensitive for security: an attacker who fully compromises it cannot steal users accounts; not without also having compromised the users’ OIDC accounts.
- While the pepper service is sensitive for liveness, in the sense that users cannot transact without their pepper, we address this by decentralizing it via a simple VRF-based design.

### HSMs or trusted hardware

Fundamentally, this approach suffers from the same problem as the MPC approach: it must use a user-friendly OIDC-based or passkey-based approach to authenticate users to an external (hardware-based) system that can sign on their behalf.

As pointed out above, our approach directly authenticates users to the blockchain validators without the additional infrastructure, without losing any security.

## Specification

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

### OIDB accounts

Below, we explain the key concepts behind how OIDB accounts are implemented:

1. What is the *public key* of an OIDB account?
2. How is the *authentication key* derived from this public key?
3. What does the *digital signature* look like for OIDC account transactions?

#### Public keys

The **public key** of an OIDB account consists of:

1. $\mathsf{iss\\_val}$: the OIDC provider’s identity, as it appears in a JWT’s `iss` field (e.g., `https://accounts.google.com`), denoted by $\mathsf{iss\\_val}$
2. $\mathsf{addr\\_idc}$: an **identity commitment (IDC)**, which is a <u>hiding</u> commitment to:
   - The owning user’s identifier issued by the OIDC provider (e.g., `alice@gmail.com`), denoted by $\mathsf{uid\\_val}$.
   - The name of the JWT field that stores the user identifier, denoted by $\mathsf{uid\\_key}$. Currently, we only allow `sub` or `email`[^jwt-email-field].
   - The managing application’s identifier issued to it during registration with the OIDC provider (i.e., an OAuth `client_id` stored in the JWT’s `aud` field), denoted by $\mathsf{aud\\_val}$. 

A bit more formally (but ignoring complex implementation details), the IDC is computed by hashing the fields above using a SNARK-friendly hash function $H'$:

```math
\mathsf{addr\_idc} = H'(\mathsf{uid\_key}, \mathsf{uid\_val}, \mathsf{aud\_val}; r),\ \text{where}\ r\stackrel{\$}{\gets} \{0,1\}^{256}
```

#### Peppers

Note the use of a (high-entropy) blinding factor $r$ to derive the IDC above. This ensures that the IDC is indeed a hiding commitment to the user’s and managing application’s identity. Throughout this AIP, this blinding factor is referred to as a privacy-preserving **pepper**.

The pepper has two important properties:

1. Knowledge of the pepper $r$ will be needed when signing transactions to authorize access to the account. 
2. If the pepper is publicly-revealed, this will **not** give an attacker access to the account associated with this public key. In other words, unlike a secret key, the pepper does not need to remain secret in order to protect the security of the account; only the privacy of the account.

Put more simply:

- If the **pepper is lost**, then access to the **account is lost**. 
- If the **pepper is revealed** (e.g., stolen), then only **privacy of the account is lost** (i.e., the user and app identity in $\mathsf{addr\\_idc}$ can be brute-forced and ultimately revealed).

Relying on users to remember their pepper $r$ would maintain the status-quo of easy-to-lose secret-key-based accounts and thus *defeat the point of OpenID-based blockchain accounts*.

Therefore, we introduce a **pepper service** that can help users recover their pepper (we discuss its properties [in the appendix](#Pepper-service)).

#### Authentication keys

Next, the **authentication key** of an OIDB account is simply the hash of its public key defined above. More formally, assuming any cryptographic hash function $H$, the authentication key is:

```math
\mathsf{auth\_key} = H(\mathsf{iss\_val}, \mathsf{addr\_idc})
```

**Note:** In practice, a domain separator is also hashed in above, but for simplicity of exposition, we ignore such details.

#### Secret keys

After defining the “public key” above, a natural question arises:

> What is the secret key associated with this public key?

The answer is there is no additional secret key that the user has to write down. Instead, the “secret key”, consists of the user’s ability to sign in to the OIDC account via the managing application committed in the $\mathsf{auth\\_key}$ above.

Put differently, the “secret key” can be thought of as the user’s password for that account, which the user already knows, or a pre-installed HTTP cookie which precludes the need for the user to re-enter the password. Although, this **password is not sufficient**: the managing application must be available: it must allow the user to sign in to their OIDC account and receive the OIDC signature. (We discuss [how to deal with disappearing apps](#alternative-recovery-paths-for-when-managing-applications-disappear) later on.)

More formally, if a user can successfully use the application identified by $\mathsf{aud\\_val}$ to sign in (via OAuth) to their OIDC account identified by $(\mathsf{uid\\_key}, \mathsf{uid\\_val})$ and issued by the OIDC provider identified by $\mathsf{iss\\_val}$, then that ability acts as that users “secret key.”

#### _Warm-up_: Leaky signatures that reveal the user’s and app’s identity

Before describing our fully privacy-preserving TXN signatures, we warm-up by describing **leaky signatures** that reveal the identity of the user and the app: i.e., they leak $\mathsf{uid\\_key}, \mathsf{uid\\_val}$ and $\mathsf{aud\\_val}$.

A **leaky signature** $\sigma_\mathsf{txn}$ over a transaction $\mathsf{txn}$ for an address with authentication key $\mathsf{auth\\_key}$ is defined as:

```math
\sigma_\mathsf{txn} = (\mathsf{uid\_key}, \mathsf{jwt}, \mathsf{header}, \mathsf{epk}, \sigma_\mathsf{eph}, \sigma_\mathsf{oidc}, \mathsf{exp\_date}, \rho, r)
```

where:

1. $\mathsf{uid\\_key}$ is the JWT field’s name that stores the user’s identity, whose value is committed in the address IDC
2. $\mathsf{jwt}$ is the JWT payload (e.g., see [an example here](#JWT-header-and-payload-example))
3. $\mathsf{header}$ is the JWT header; indicates the OIDC signature scheme and the JWK’s key ID, which are needed to verify the OIDC signature under the correct PK
4. $\mathsf{epk}$, is an **ephemeral public key (EPK)** generated by the managing application (its associated $\mathsf{esk}$ is kept secret on the managing application side)
5. $\sigma_\mathsf{eph}$ is an **ephemeral signature** over the transaction $\mathsf{txn}$
6. $\sigma_\mathsf{oidc}$ is the OIDC signature over the full JWT (i.e.,  over the $\mathsf{header}$ and $\mathsf{jwt}$ payload)
7. $\mathsf{exp\\_date}$ is a timestamp past which $\mathsf{epk}$ is considered expired and cannot be used to sign TXN.
9. $\rho$ is a high-entropy **EPK blinding factor** used to create an **EPK commitment** to $\mathsf{epk}$ and $\mathsf{exp\\_date}$ that is stored in the $\mathsf{jwt}[\texttt{"nonce"}]$ field
10. $r$ is the pepper for the address IDC, which is assumed to be zero in this "leaky mode"

**tl;dr**: To **verify the $\sigma_\mathsf{txn}$ signature**, validators check that the OIDC provider (1) signed the user and app IDs that are committed in the address IDC and (2) signed the EPK which, in turn, signed the transaction, while enforcing some expiration date on the EPK.

In more detail, signature verification against the PK $(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$ involves the following:

1. If using `email`-based IDs, ensure the email has been verified:
   1. If $\mathsf{uid\\_key}\stackrel{?}{=}\texttt{"email"}$, assert $\mathsf{jwt}[\texttt{"email\\_verified"}] \stackrel{?}{=} \texttt{"true"}$
1. Let $\mathsf{uid\\_val}\gets\mathsf{jwt}[\mathsf{uid\\_key}]$
1. Let $\mathsf{aud\\_val}\gets\mathsf{jwt}[\texttt{"aud"}]$
1. Assert $\mathsf{addr\\_idc} \stackrel{?}{=} H'(\mathsf{uid\\_key}, \mathsf{uid\\_val}, \mathsf{aud\\_val}; r)$, using the pepper $r$ from the signature
1. Verify that the PK matches the authentication key on-chain:
   1. Assert $\mathsf{auth\\_key} \stackrel{?}{=} H(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$
1. Check the EPK is committed in the JWT’s `nonce` field:
   1. Assert $\mathsf{jwt}[\texttt{"nonce"}] \stackrel{?}{=} H’(\mathsf{epk},\mathsf{exp\\_date};\rho)$
1. Check the EPK expiration date is not too far off into the future (we detail this below):
   1. Assert $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{max\\_exp\\_horizon}$, where $\mathsf{max\\_exp\\_horizon}$ is an on-chain parameter
   1. We do not assert the expiration date is not in the past (i.e., assert $\mathsf{exp\\_date} > \mathsf{jwt}[\texttt{"iat"}]$). Instead, we assume that the JWT’s issued-at timestamp (`iat`) field is correct and therefore close to the current block time. So if an application mis-sets $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}]$, then the EPK will be expired and useless.
1. Check the EPK is not expired:
   1. Assert $\texttt{current\\_block\\_time()} < \mathsf{exp\\_date}$
1. Verify the ephemeral signature $\sigma_\mathsf{eph}$ under $\mathsf{epk}$ over the transaction $\mathsf{txn}$
1. Fetch the correct PK of the OIDC provider, denoted by $\mathsf{jwk}$, which is identified via the `kid` field in the JWT $\mathsf{header}$.
1. Verify the OIDC signature $\sigma_\mathsf{oidc}$ under $\mathsf{jwk}$ over the JWT $\mathsf{header}$ and payload $\mathsf{jwt}$.

**JWK consensus:** This last step that verifies the OIDC signature requires that validators **agree on the latest JWKs** (i.e., public keys) of the OIDC provider, which are periodically-updated at a provider-specific **OpenID configuration URL** (see [the appendix](#jwk-consensus)).

The process by which Aptos validators reach consensus on the JWKs of all supported OIDC providers will be the subject of a different AIP. For now, this AIP assumes such a mechanism is in place for validators to fetch a provider’s current JWKs via a Move module in `aptos_framework::jwks`.

**The need for an expiration date horizon:** We believe it would be risky for clueless dapps to set an $\mathsf{exp\\_date}$ that is too far into the future. This would create a longer time window for an attacker to compromise the signed JWT (and its associated ESK). As a result, we enforce that the expiration date is not too far into the future based on the `iat` JWT field and an “expiration horizon” $\mathsf{max\\_exp\\_horizon}$: i.e, we ensure that $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{max\\_exp\\_horizon}$.

An alternative would be to ensure that $\mathsf{exp\\_date} < \texttt{current\\_block\\_time()} + \mathsf{max\\_exp\\_horizon}$. However, this is not ideal. An attacker might create an $\mathsf{exp\\_date}$ that fails the check for the current time $t_1 = \texttt{current\\_block\\_time()}$ (i.e., $\mathsf{exp\\_date} \ge t_1 + \mathsf{max\\_exp\\_horizon}$) but passes the check later on when the time becomes $t_2 > t_1$ (i.e., $\mathsf{exp\\_date} < t_2 + \mathsf{max\\_exp\\_horizon}$). This design would therefore allow for signed JWTs that appear invalid (and therefore harmless) to later become valid (and therefore attack-worthy). Relying on the `iat` avoids this issue.

**Leaky mode caveats** that will be addressed next:

- The pepper $r$ is leaked by the transaction, which allows brute-forcing of the address IDC.
- Similarly, the EPK blinding factor $\rho$ does not yet serve its privacy-preserving purpose since it is revealed by the TXN.
- The JWT payload is included in plaintext and leaks the identities of the managing application and user.
- Even if the JWT payload were hidden, the OIDC signature could leak these identities, since the signed JWT could be low-entropy. Therefore, an attacker could brute-force the signature verification on a small subset of likely-to-have-been-signed JWTs.

#### Zero-knowledge signatures

This gets us to the _essence of this AIP_: we are now ready to describe how privacy-preserving signatures work for our OIDB accounts. These signatures leak _nothing_ about the user’s OIDC account nor the managing app’s ID associated with the accessed OIDB account.

A **zero-knowledge signature** $\sigma_\mathsf{txn}$ over a transaction $\mathsf{txn}$ for an address with authentication key $\mathsf{auth\\_key}$ is defined as:

```math
\sigma_\mathsf{txn} = (\mathsf{header}, \mathsf{epk}, \sigma_\mathsf{eph}, \mathsf{exp\_date}, \mathsf{exp\_horizon}, \pi)
```

where:

3. $(\mathsf{header}$, $\mathsf{epk}$, $\sigma_\mathsf{eph}$, $\mathsf{exp\\_date}$ are as before
4. $\mathsf{exp\\_horizon}$, which is $\le \mathsf{max\\_exp\\_horizon}$; the $\mathsf{exp\\_date}$ must be between $\mathsf{jwt}[\texttt{"iat"}]$ and $\mathsf{jwt}[\texttt{"iat"}]+\mathsf{exp\\_horizon}$
5. $\pi$ is a **zero-knowledge proof of knowledge (ZKPoK)** for the the ZK relation $\mathcal{R}$ (defined below).

Note that it no longer contains any identifying user information (beyond the identity of the OIDC provider in $\mathsf{iss\\_val}$)

**tl;dr**: To **verify the $\sigma_\mathsf{txn}$ signature**, validators verify a ZKPoK of an OIDC signature over (1) the user and app IDs that are committed in the authentication key and (2) the EPK which, in turn, signed the transaction, while enforcing some expiration date on the EPK.

In more detail, signature verification agains the PK $\mathsf{iss\\_val}, \mathsf{addr\\_idc}$ involves the following:

1. Assert $\mathsf{auth\\_key} \stackrel{?}{=} H(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$, as before.
2. Check the expiration date horizon is within bounds:
   1. Assert $\mathsf{exp\\_horizon} \in (0, \mathsf{max\\_exp\\_horizon})$, where $\mathsf{max\\_exp\\_horizon}$ is an on-chain parameter, as before.
3. Check the EPK is not expired:
   1. Assert $\mathsf{exp\\_date} < \texttt{current\\_block\\_time()}$, as before.
4. Verify the ephemeral signature $\sigma_\mathsf{eph}$ under $\mathsf{epk}$ over the transaction $\mathsf{txn}$, as before.
5. Fetch the correct PK of the OIDC provider, denoted by $\mathsf{jwk}$, as before.
6. Verify the ZKPoK $\pi$, which agues that $\exists$ a *private input* $`\textbf{w}=[(\mathsf{aud\\_val}, \mathsf{uid\\_key}, \mathsf{uid\\_val}, r),(\sigma_\mathsf{oidc}, \mathsf{jwt}), \rho]`$ such that the relation $\mathcal{R}(\textbf{x}; \textbf{w})=1$ for the *public input* $\textbf{x} = [(\mathsf{iss\\_val}, \mathsf{jwk}, \mathsf{header}), (\mathsf{epk},    \mathsf{exp\\_date}), \mathsf{addr\\_idc}, \mathsf{exp\\_horizon}]$
   - Importantly, the proof $\pi$ leaks nothing about the privacy-sensitive inputs in $\textbf{w}$.

The **ZK relation $\mathcal{R}$** simply **performs the privacy-sensitive part of the verification** from the **leaky mode** above:

Specifically, the relation is satisfied; i.e., 

```math
\mathcal{R}\begin{pmatrix}
	\textbf{x} = [
        (\mathsf{iss\_val}, \mathsf{jwk}, \mathsf{header}), 
        (\mathsf{epk}, \mathsf{exp\_date}), 
        \mathsf{addr\_idc}, \mathsf{exp\_horizon}
    ],\\ 
    \textbf{w} = [
        (\mathsf{aud\_val}, \mathsf{uid\_key}, \mathsf{uid\_val}, r),
        (\sigma_\mathsf{oidc}, \mathsf{jwt}), 
    \rho]
\end{pmatrix} = 1
```

if and only if:

1. Check the OIDC provider ID in the JWT:
   1.  Assert $\mathsf{iss\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"iss"}]$
2. If using `email`-based IDs, ensure the email has been verified:
   1. If $\mathsf{uid\\_key}\stackrel{?}{=}\texttt{"email"}$, assert $\mathsf{jwt}[\texttt{"email\\_verified"}] \stackrel{?}{=} \texttt{"true"}$
3. Check the user’s ID in the JWT:
   1. Assert $\mathsf{uid\\_val}\stackrel{?}{=}\mathsf{jwt}[\mathsf{uid\\_key}]$
4. Check the managing application’s ID in the JWT:
   1. Assert $\mathsf{aud\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"aud"}]$
5. Check the address IDC uses the correct values from the JWT:
   1. Assert $\mathsf{addr\\_idc} \stackrel{?}{=} H'(\mathsf{uid\\_key}, \mathsf{uid\\_val}, \mathsf{aud\\_val}; r)$
6. Check the EPK is committed in the JWT’s `nonce` field:
   1. Assert $\mathsf{jwt}[\texttt{"nonce"}] \stackrel{?}{=} H’(\mathsf{epk},\mathsf{exp\\_date};\rho)$
7. Check the EPK expiration date is not too far off into the future:
   1. Assert $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{exp\\_horizon}$
8. Verify the OIDC signature $\sigma_\mathsf{oidc}$ under $\mathsf{jwk}$ over the JWT $\mathsf{header}$ and payload $\mathsf{jwt}$.

**Note:** The additional $\mathsf{exp\\_horizon}$ variable is a layer of indirection: it ensures that when the $\mathsf{max\\_exp\\_horizon}$ parameter on chain changes ZKPs do not become stale since they take $\mathsf{exp\\_horizon}$ as public input, not $\mathsf{max\\_exp\\_horizon}$ .

**Zero-knowledge mode caveats** that we address later:

1. The pepper $r$ is fetched by the user/wallet from the pepper service, which we describe briefly [in the appendix](#pepper-service)
2. **Computing ZKPs is slow**. This will require a proving service, which we describe briefly [in the appendix](#(Oblivious)-ZK-proving-service)
3. **Bugs in the ZK relation implementation** can be addressed using [“training wheels” mode](#training-wheels)

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

### Choice of ZKP system: Groth16

Our initial deployment will use the Groth16 ZKP system[^groth16] over BN254[^bn254] elliptic curves. We chose Groth16 for several reasons:

1. Has a **small proof size** (smallest of of any ZKP system)
2. Has **constant verification time**
3. Has fast **proving time** (3.5 seconds on Macbook Pro M2, with multithreading)
4. The relative ease of implementing our relation in `circom`[^circom]
5. The relatively-great tooling built around `circom`
6. It can be made **non-malleable**, which is needed for non-malleability of our TXN signatures.

Unfortunately, Groth16 is a pre-processing SNARK with a relation-specific trusted setup. This means we must coordinate an **MPC-based trusted setup ceremony** for our ZK relation $\mathcal{R}$ which is outside the scope of this AIP.

A consequence of this is that we cannot upgrade/bugfix our ZK relation implementation without redoing the setup. Therefore, in the future, we will likely transition to either a **transparent** SNARK or one with a one-time, relation-independent **universal trusted setup**.

### Reference implementation

We will add more links to our circuit code and Rust TXN authenticator below:
 - [Rust authenticator code for the leaky mode](https://github.com/aptos-labs/aptos-core/pull/11681)
 - [Rust authenticator code for the Groth16-based ZKP mode](https://github.com/aptos-labs/aptos-core/pull/11772)

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

### Correctness and soundness of signature verification

- <u>Unexpired</u> [ZKPoKs of] OIDC signatures from supported providers 
- <u>Expired</u> [ZKPoKs of] OIDC signatures from supported providers do NOT verify.
- Signatures from **un**supported providers do NOT verify.
- [ZKPoKs of] OIDC signatures *without* an ephemeral signatures fail validation.
- ZKPs are not malleable.

### Other tests

- Test that transactions which include a large number of OIDC accounts validate quickly.

We will expand later on the testing plan. **(TBA.)**

## Risks and Drawbacks

 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
 > - Any backwards compatibility issues we should be aware of?
 > - If there are issues, how can we mitigate or resolve them

All the risk and drawbacks are described in the [“Security, Liveness and Privacy Considerations” section](#Security,-Liveness-and-Privacy-Considerations).

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

In general, this approach could help onboard the next billion users by removing hurdles associated with mnemonics and secret key management.

In one year, this proposal could lead to a radically-different dapp ecosystem that allows for very easy user onboarding via their (say) Google accounts, without asking users to connect a wallet. 

Similarly, the wallet ecosystem could flourish by allowing users to onboard without writing down a mnemonic.

It is also likely to result in more secure web-wallets for Aptos, since such wallets will no longer have to maintain long-lived secret keys for users (or rely on complex MPC or HSM systems to do it on their behalf).

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

There are many components, all of which interact with one another, making it difficult to stage the devleopment:

1. ZK relation implementation in `circom`[^circom].
2. Rust TXN authenticator
3. Centralized pepper service
4. Centralized proving service (with [“training wheels”](#training-wheels))
5. JWK consensus on top of the Aptos validators
6. Trusted setup MPC ceremony

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

We are currently working on SDK support. The rest will follow. **(TBA.)**

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

On devnet in February.

On mainnet in March.

On testnet in sometimes in between.

## Security, Liveness and Privacy Considerations

 > - Does this result in a change of security assumptions or our threat model?
 > - Any potential scams? What are the mitigation strategies?
 > - Any security implications/considerations?
 > - Any security design docs or auditing materials that can be shared?

### Training wheels

In our initial deployment, we plan on having the prover service include an additional **training wheels signature** over the ZKP, after having verified the relation holds, before computing the proofs. This allows us to eliminate a single-point of failure (i.e., the ZK relation implementation) without giving extra power to the prover service to compromise accounts.

Specifically, with training wheels on, a break in our ZK relation implementation (currently, done in Circom[^circom], which is error prone) will not result in a catastrophic loss of funds for our users. At the same time, it remains that a compromised proving service on its own cannot steal funds: it must still compute (or forge) a valid ZKP for the victim account like everyone else. 

An important **liveness consideration** of this is that if the proving service is down, users will not be able to access their accounts. Nonetheless, if outages do happen we expect them to be brief and a price worth paying for securing our initial deployment.

### Alternative recovery paths for when managing applications disappear

Recall that OIDB accounts are bound not just to the user but also to a managing application (e.g., a dapp or a wallet).

Unfortunately, this **managing application could disappear** for various reasons:

1. Its OAuth `client_id` might be banned by the OIDC provider (for various reasons)
2. An incompetent administrator loses the application’s OAuth `client_secret` or deletes the registered application from the OIDC provider
3. A clueless administrator simply takes down the application (e.g., removes a mobile phone app from the app store or stops running the dapp’s website) without realizing that its users will lose access to their OIDB account on that application.

In any case, **if the managing application disappears, then users will no longer be able to access their OIDB account** bound to that application, since they can no longer obtain a signed JWT without the application.

To deal with this, we propose installing **alternative recovery paths**:

- For **email-based** OIDC providers, we can replace the ZKPoK of an OIDC signature with a ZKPoK of a DKIM-signed email (with a properly-formatted message). 
  - While this will be less user-friendly, it provides emergency recovery and continues to **preserve privacy**.
  - It would be important to make sure this flow is **hard-to-phish**, since users might be tricked into sending such “account reset” emails by attackers.
  - For example, this flow could only be allowed if the account has been inactive for a long period of time. 
  - And/or, this flow might require the user to engage with another decentralized verification party which properly walks the user through an account reset flow.
- For **non-email-based** OIDC providers, alternative recovery paths could be provider-specific:
  - For **Twitter**, a user could prove they own their Twitter account by tweeting a specially-crafted message
  - Similarly, for **GitHub**, users could do the same by posting a gist.
  - Given an HTTPS oracle, validators could verify such a tweet or a gist and allow the user to rotate their account's key. This would **not** be **privacy-preserving** since, at minimum, the validators would learn the user’s identity from the HTTPS URL.
- Alternatively, all OIDB accounts could be set up as a 1 out of 2[^multiauth] with a **recovery [passkey](#Passkeys)** sub-account. This way, the passkey, if backed up automatically (e.g., on Apple platforms), then it could be used to restore access to the account.
  - A traditional SK sub-account could also be used but this would require the managing application to giver users the option to write the SK, which defeats the user-friendliness goals.

- Alternatively, for popular applications, we could consider **manual patches**: e.g., adding an override for their `client_id` in our ZK relation. (But this brings about a centralization risk.)

### Compromised OIDC provider

Recall that “your blockchain account = your OIDC account.” In other words:

- If your OIDC account is compromised, so is your OIDB account.
- If your OIDC provider (e.g., Google) is compromised, so is your OIDB account associated with that provider.

We stress that this is a **feature**, not a **bug**: we want Aptos users to leverage the security & user-friendliness of their OIDC accounts to transact easily. Nonetheless, for users who do not want to fully rely on the security of their OIDC account, they can upgrade to a $t$ out of $n$ approach, using a combination of different OIDC accounts and/or traditional SKs[^multiauth].

**Note**: We can deal with a compromised OIDC provider by revoking their JWK using an emergency governance proposal.

### OIDC providers switch to unsupported signature scheme

Our currently-implemented ZK relation only supports RSA signature verification due to its popularity amongst OIDC provider. However, if a provider suddenly switches to another scheme (e.g., Ed25519), users will no longer be able to construct ZKPs and access their accounts.

In the unlikely case that this happens, we can proceed as follows:

1. First, we enable the **leaky mode** via a feature flag. This restores access to users accounts, albeit without privacy, and should put most users at ease that their assets are safe.
2. Second, we upgrade the ZK relation to support the new scheme and deploy it to production.

### Web-based wallets and walletless dapps

OIDB accounts will give rise to (1) web-based wallets that users can sign into via (say) Google and (2) **walletless dapps** that users can sign into directly via (again, say) Google.

There are several security challenges in the web environment:

- Making sure JavaScript dependencies are not hijacked, which could lead to exfiltration of ESKs, signed JWTs or both.
- Managing the ESKs of user accounts in the browser can be risky, since they might leak due to JavaScript caching or being improperly stored. 
  - Fortunately, the Web Crypto API and/or using a passkey as the ESK should address these concerns.

### SNARK-friendly hash functions

To obtain a performant ZKP prover, we make use of a SNARK-friendly hash function[^snark-hash] called *Poseidon*[^poseidon]. Unfortunately, Poseidon is relatively new and, as a result, has not received as much cryptanalysis as older hash functions like SHA2-256. 

If there are collisions attacks on Poseidon, an attacker could change the committed user or app ID and steal funds without having to break the ZKP system nor the OIDC provider.

In the long-term, we plan on moving away from SNARK-friendly hash functions and choosing our zkSNARK proof system to remain efficient even when used with SNARK-unfriendly hash functions like SHA2-256.

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

### Set of providers with secure alternative recovery paths

An important question for deployment is what set of OIDC providers admit a secure alternative recovery path (e.g., a flow that is not easy to phish)?

### Where should webapp developers store the ESK and signed JWT by default?

For mobile phone apps, storing the ESK is not a concern: everything will be stored in the app’s storage.

However, for webapps (e.g., dapps or web-wallets) there are two options:

1. Use the OAuth implicit grant flow and store everything in the browser (e.g., local storage, IndexedDB). 
   - This way, even if a dapp/web-wallet is compromised, the user’s assets cannot be stolen unless they go to the compromised website and trigger some malicious JS.
2. Use the OAuth authorization grant flow and store the ESK in the browser and the signed JWT in the backend.
   - Unfortunately, some OIDC providers allow refreshing the signed JWT from the backend on a new `nonce` field, without the user’s consent. This means a compromised backend can refresh the signed JWT on an EPK it controls and steal OIDB accounts (assuming the OAuth session has not expired). This can be done without the user’s involvement in accessing the compromised website.

### What should $\mathsf{max\\_exp\\_horizon}$ be set to?

Recall that the $\mathsf{exp\\_date}$ cannot exceed $\mathsf{jwt}[\texttt{"iat"}]+\mathsf{max\\_exp\\_horizon}$.

Constraints:

- Cannot be too short, since this would require refreshing the signed JWTs too often, which in turn would require recomputing the ZKPs too often.

- Cannot be too long, since this increases the window in which a signed JWT and its committed ESK can be stolen.

### Zero-knowledge TXNs still leak the OIDC provider’s identity

Currently, zero-knowledge TXNs leak which OIDC provider is involved by revealing the $\mathsf{iss\\_val}$ field  (e.g., Google, GitHub).

However, we could modify our ZK relation to hide the OIDC provider too. Specifically, instead of taking in the $\mathsf{jwk}$ as a *public* input, the relation would take it as a *private* input, and then would verify membership of this JWK in a list of approved JWKs committed on chain. (Otherwise, users can input any JWK and forge TXN signatures.)

## Appendix

### JWT header and payload example

This is a JWT obtained from the Google OAuth playground[^oauth-playground].

JWT header:

```
{
  "alg": "RS256",
  "kid": "822838c1c8bf9edcf1f5050662e54bcb1adb5b5f",
  "typ": "JWT"
}
```

JWT payload:

```
{
  "iss": "https://accounts.google.com",
  "azp": "407408718192.apps.googleusercontent.com",
  "aud": "407408718192.apps.googleusercontent.com",
  "sub": "103456789123450987654",
  "email": "alice@gmail.com",
  "email_verified": true,
  "at_hash": "a5z9bu-5jokhN3pmxj2kMg",
  "iat": 1684349149,
  "exp": 1684352749
}
```

### Pepper service

The pepper service will help users recover their account’s pepper, which if lost would result in the loss of their account. 

Its design is outside the scope of this AIP, but here we highlight some of its key properties:

- Much like the blockchain validators, the service **authenticates the user** before revealing their pepper to them
  - Authentication will be done via the same OIDC signatures used to create TXN signatures.

- The service computes peppers using a **verifiable random function (VRF)**
- This makes the service simple to **decentralize**, either as its own separate system or on top of Aptos validators.
- The pepper service will be **privacy-preserving**: it will learn neither (1) the identity of the user requesting their pepper nor (2) the actual pepper that it computed for that user.
- The pepper service will be mostly “**stateless**”, in the sense that it will only store the VRF secret key from which it will derive users’ peppers.

### (Oblivious) ZK proving service

As long as the ZKP proving overhead in the browser and on mobile phones remains high, there will be a **ZK proving service** to help users compute their ZKPs fast. 

Its design is outside the scope of this AIP, but here we highlight some of its key properties:

- If the service is down, users can still access their account (although more slowly), since they can always compute ZKPs on their own.
  - Unless the proving service is operating with “training wheels” on (see [below](#training-wheels))

- It should be **decentralized**, either in a permissioned or permissionless fashion.
- It should be difficult to attack via **denial of service (DoS)** attacks
- It should be **oblivious** or **privacy-preserving**: it will not learn anything about the private input in the ZK relation (e.g., the identity of the user requesting a proof, the pepper for that user, etc.)
- The proving service will be mostly “**stateless**”, in the sense that it will only store a public proving key needed to compute ZKPs for our ZK relation $\mathcal{R}$.

### JWK consensus

Transaction signatures for OIDB accounts involve verifying an OIDC signature. This requires that validators **agree on the latest JWKs** (i.e., public keys) of the OIDC provider, which are periodically-updated at a provider-specific **OpenID configuration URL**. 

The design and implementation of JWK consensus is outside the scope of this AIP, but here we highlight some of its key properties:

- The validators will frequently scan for JWK changes at every supported provider’s **OpenID configuration URL**
- When a change is detected by a validator, that validator will propose the change via a one-shot consensus mechanism
- Once the validators agree, the new JWKs will be reflected in a public Move module in `aptos_framework::jwks`.

## References

[^bn254]: https://hackmd.io/@jpw/bn254
[^bonsay-pay]: https://www.risczero.com/news/bonsai-pay
[^circom]: https://docs.circom.io/circom-language/signals/
[^groth16]: **On the Size of Pairing-Based Non-interactive Arguments**, by Groth, Jens, *in Advances in Cryptology -- EUROCRYPT 2016*, 2016
[^HPL23]: **The OAuth 2.1 Authorization Framework**, by Dick Hardt and Aaron Parecki and Torsten Lodderstedt, 2023, [[URL]](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/08/)
[^jwt-email-field]: Use of the `email` field will be restricted to OIDC providers that never change its value (e.g., email services like Google), since that ensures users cannot accidentally lock themselves out of their blockchain accounts by changing their Web2 account’s email address.
[^multiauth]: See [AIP-55: Generalize Transaction Authentication and Support Arbitrary K-of-N MultiKey Accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)
[^multisig]: There are alternatives to single-SK accounts, such as multisignature-based accounts (e.g., via [MultiEd25519](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/multi_ed25519.move) or via [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)), but they still bottle down to one or more users protecting their secret keys from loss or theft.
[^nozee]: https://github.com/sehyunc/nozee
[^oauth-playground]: https://developers.google.com/oauthplayground/
[^poseidon]: **Poseidon: A New Hash Function for Zero-Knowledge Proof Systems**, by Lorenzo Grassi and Dmitry Khovratovich and Christian Rechberger and Arnab Roy and Markus Schofnegger, *in USENIX Security’21*, 2021, [[URL]](https://www.usenix.org/conference/usenixsecurity21/presentation/grassi)
[^snark-hash]: https://www.taceo.io/2023/10/10/how-to-choose-your-zk-friendly-hash-function/
[^snark-jwt-verify]: https://github.com/TheFrozenFire/snark-jwt-verify/tree/master
[^zk-blind]: https://github.com/emmaguo13/zk-blind
[^zklogin]: https://docs.sui.io/concepts/cryptography/zklogin
