---
aip: 61
title: Keyless accounts
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/297
Status: Approved
last-call-end-date (*optional): 02/15/2024
type: <Standard (Core, Framework)>
created: 01/04/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-61 - Keyless accounts

## Summary

 >  Summarize in 3-5 sentences what is the problem we’re solving for and how are we solving for it

Currently, the only way[^multisig] to secure your Aptos account is to protect the **secret key (SK)** associated with it. Unfortunately, this is much easier said than done. In reality, secret keys are often *lost* (e.g., users forget to write down their mnemonic when first setting up their Aptos wallet) or *stolen* (e.g., users are tricked into revealing their SK). This makes onboarding users unnecessarily difficult and drives users away when their accounts are lost or stolen.

In this AIP, we describe a more user-friendly approach for account management that relies on:

1. The _unmodified_[^openpubkey] **OpenID Connect (OIDC)** standard,
2. Its blockchain applications[^openzeppelin]$^,$[^eip-7522]$^,$[^zkaa],
3. Recent developments in **zero-knowledge proofs of knowledge (ZKPoKs)** of **OIDC signatures**[^snark-jwt-verify]$^,$[^nozee]$^,$[^bonsay-pay]$^,$[^zk-blind]$^,$[^zklogin].

Specifically, we enable **keyless accounts** on Aptos that are secured through the owner’s existing **OIDC account** (i.e., their Web2 account with an **OIDC provider** such as Google, GitHub or Apple), rather than through a difficult-to-manage secret key. In a nutshell, _“your blockchain account = your OIDC account”_.

> [!WARNING]
> An important property of keyless accounts is that they are not only *bound* to the user’s OIDC account (e.g., `alice@gmail.com`) but are also bound to a **managing application** registered with the OIDC provider (e.g., a dapp’s `dapp.xyz` website, or a wallet’s mobile phone app). In other words, they are **application-specific** accounts. As a consequence, if the managing application of an account disappears or loses their OIDC provider registration credentials, then users whose accounts are bound to this application will become inaccessible, unless alternative **recovery paths** are provided (discussed below).

### Goals

 > What are the goals and what is in scope? Any metrics?
 > Discuss the business impact and business value this change would impact

1. **User-friendliness:**
   1. Blockchain accounts should be backed by user-friendly OIDC accounts, which makes them easy-to-access (and thus hard-to-lose-access)
   2. Enable users to interact with dapps via their OIDC accounts, without having to install a wallet: i.e., a **walletless experience**.
   3. Enable users to easily-access their blockchain account from any device

2. **Security:**
   1. Keyless accounts should be as secure as their underlying OIDC account (see discussion [here](#compromised-oidc-account))
   2. Keyless accounts should be recoverable if the managing applications disappears (see alternative recovery paths discussion below)

3. **Privacy**: 
   1. Keyless accounts and their associated transactions should **not** leak any information about the user’s OIDC account (e.g., a Google user’s email address or their OAuth `sub` identifier).
   2. The OIDC provider (e.g., Google) should not be able to track the user’s transaction activity.
   3. Keyless accounts for the same user but with different managing applications should not be linkable on chain.
4. **Efficiency**: Transactions for keyless accounts should be efficient to create by wallets/dapps (< 1 second) and efficient to validate by Aptos validators (< 2 milliseconds).
5. **Censorship-resistance:** Aptos validators should not be able to give preferential treatment to OpenID transactions based on the identity of the managing application or user.
6. **Decentralization**: Keyless accounts should not require the existence of parties that can never be decentralized.

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
- Relevant JWT payload fields (e.g., `aud`, `sub`, `iss`, `email_verified`, `nonce`, `iat`, `exp`)
- **JSON Web Keys (JWKs)**, which are published by each OIDC provider at a JWK endpoint URL indicated in their OpenID configuration URL

#### Terminology

- **OIDC account**: A Web2 account with an OIDC provider such as Google (e.g., `alice@gmail.com`)
- **Keyless account**: A blockchain account whose security and liveness is backed by an OIDC account (e.g., a Google account) rather than a secret key. The heart of this AIP is to explain how such keyless accounts can be safely implemented.
- **Application-specific keyless accounts**: A keyless account is **bound** both the user’s identity (e.g., `alice@gmail.com` and the managing application’s identity (e.g., `dapp.xyz`). This means that, in order to access the account, a signed JWT token over that user’s identity and over the managing application’s identity must be exhibited. Such a token can only be obtained through signing in the managing application via the user’s OIDC provider (e.g., Google). This has [important implications](#alternative-recovery-paths-for-when-managing-applications-disappear).

#### tl;dr on OIDC

For the purposes of this AIP, the most important thing to understand about OIDC is that it enables a **managing application** (e.g., `dapp.xyz` or `some-wallet.org` or a mobile phone app) to sign in its users via their OIDC provider (e.g, Google) without learning that user’s OIDC credentials (i.e., Google account password). Importantly, if (and only if) the user successfully logs in, then **only** the managing application (and no one else) receives a **signed JWT** from Google as a publicly-verifiable proof of the user having logged in.

The purpose of this AIP will be to demonstrate how this signed JWT can be used to authorize transactions for a keyless account associated with that user *and* managing application.

#### Zero-knowledge proofs

We assume familiarity with zero-knowledge proof (ZKP) systems: i.e., a ZKP system for a **relation** $R$ allows a **prover** to convince a **verifier**, who has a **public input** $x$,  that the prover knows a **private input** $w$ such that $R(x; w) = 1$ (i.e., “it holds”) without leaking any information about $w$ to the verifier, beyond the fact that the relation holds.

Other ZKP terms:

- **Proving key** and **verification key**
- **Relation-specific trusted setup**

We assume a SNARK-friendly hash function $H_\mathsf{zk}$ that is efficient to prove inside our ZKP.

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

1. Explaining the intricacies of how keyless accounts work
2. Describing our initial Rust implementation of the keyless transaction authenticator

### Out of Scope

 > What are we committing to not doing and why are they scoped out?

1. Security of DNS and X.509 certificate ecosystem
   - Keyless accounts rely on OAuth and OIDC, whose security in turn relies on the security of DNS and the X.509 certificate ecosystem.
   - So does all the software on the Internet, so we consider this out-of-scope
2. Malicious wallet applications that impersonate a genuine wallet application
   - We assume an attacker is **not** able to publish a mobile phone app in (say) Apple’s App Store that impersonates a wallet’s registered OAuth `client_id`
   - We assume an attacker is **not** able to trick a user into installing a malicious desktop app that impersonates another app’s OAuth `client_id`. For this reason, we do **not** recommend managing applications for keyless accounts that are desktop apps, since they are very easy to impersonate.
3. In-depth discussion of auxiliary backend components necessary for keyless accounts:
   - **Pepper service**, which is the scope of AIP-81[^aip-81], but is overviewed in [the appendix](#pepper-service)
   - **ZK proving service**, which is the scope of  AIP-75[^aip-75], but is overviewed in [the appendix](#(oblivious)-zk-proving-service)
   - **Consensus on JSON Web Keys (JWKs)**, which is the scope of AIP-67[^aip-67], but is overviewed in [the appendix](#jwk-consensus)
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
   - Familiarize themselves with the SDK for keyless accounts
   - If desired, dapps can enable a **walletless experience** where users can sign in to the dapp directly via their OpenID account (e.g., their Google account) without connecting a wallet.
   - This will give the user access to their **dapp-specific blockchain account** for that dapp. This way, since this account is scoped only to that dapp, the dapp can authorize transactions “blindly” on the user’s behalf, without complicated TXN prompts.
2. Wallet developers
   - Familiarize themselves with the SDK for keyless accounts
   - Consider switching their default user onboarding flow to use keyless accounts
3. Users
   - Familiarize themselves with the security model of keyless accounts
   - Understand that their account would be as secure as their OpenID account (e.g., their Google account)
   - Understand how to [recover their account](#recovery-service), should the managing application become unavailable

## Alternative solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

### Passkeys

An alternative solution that precludes the need for users to manage their own secret keys are **passkeys** and the **WebAuthn standard** built around them. A passkey is a secret key associated with an application or website that is backed up in the user’s cloud (e.g., Apple’s iCloud, Google’s Password Manager, etc.)

Passkeys were originally introduced as a way of replacing passwords for websites, by having a website associate each user with their passkey public key, rather than their password. This way, a user can securely authenticate themselves to the website by signing a random challenge using their corresponding passkey secret key, which is safely backed up in their cloud.

A natural inclination is to leverage passkeys for blockchain accounts, by setting the account’s secret key to be a passkey secret key. Unfortunately, passkeys currently have two drawbacks, which are likely to be addressed in the future. Specifically, **passkeys are not always backed up to the cloud** on some platforms (e.g., Microsoft Windows). Furthermore, passkeys introduce a **cross-device problem**: if a user creates a blockchain account on their Apple phone, their passkey secret key is backed up to iCloud, which will not be accessible from that user’s other Android device, Linux device or Windows device, since support for cross-platform backup of passkeys is not yet implemented.

A future direction for leveraging passkeys would be to encrypt the user’s mnemonic using their passkey, which would provide an additional back up option. Unfortunately, it is not clear how widely-supported the WebAuthn PRF extension[^webauthn-prf] is.

### Multi-party computation (MPC)

An alternative solution that precludes the need for users to manage their own secret keys is to rely on a **multi-party computation (MPC)** service to compute signatures for users after they have been authenticated **somehow**.

Typically, users must authenticate themselves to the MPC in a user-friendly manner (i.e., without managing SKs). Otherwise, the MPC system does not solve any UX problem and would thus be useless. As a result, most MPC systems use either OIDC or passkeys to authenticate users before signing on their behalf. 

This has two problems. First, the MPC system will learn who is transacting and when: i.e., the OIDC accounts and their corresponding on-chain account addresses.

Second, the MPC is superfluous since users can be authenticated directly to the validators via OIDC (as argued in this AIP) or via passkeys (as argued [above](#passkeys)).

Put differently, **keyless accounts sidestep the need for a complex MPC signing service** (which can be tricky to implement securely and robustly) by directly authenticating users via OIDC.

In fact, keyless accounts are **more secure** than MPC-based accounts, since a compromise of the MPC system would allow for account theft. In contrast, keyless accounts **cannot** be stolen unless (1) the user’s OIDC account is compromised or (2) the OIDC provider itself is compromised!

Nonetheless, keyless accounts still rely on a distributed pepper service and a ZK proving service (see [the appendix](#appendix)). However:

- The proving service is needed only for performance when computing ZKPs in the browser or on phones and stands to be removed in the future when the ZKP system is optimized.
- The pepper service, unlike the MPC service, is not sensitive for security: an attacker who fully compromises it cannot steal users accounts; not without also having compromised the users’ OIDC accounts.
- While the pepper service is sensitive for liveness, in the sense that users cannot transact without their pepper, we can address this by decentralizing it via a simple VRF-based design.

An **advantage** of MPC systems is that the MPC nodes can do **fraud detection** before signing a TXN. The advantages of doing fraud detection in MPC versus doing it in the wallet or via account abstraction would need to be studied more.

### HSMs or trusted hardware

Fundamentally, this approach suffers from the same problem as the MPC approach: it must use a user-friendly OIDC-based or passkey-based approach to authenticate users to an external (hardware-based) system that can sign on their behalf.

Therefore, this external system (i.e., the HSM) is an unnecessary point of failure that can be compromised.

As pointed out above, our approach directly authenticates users to the blockchain validators without this additional infrastructure and risk.

The advantage of HSMs or trusted hardware is their lower implementation complexity. Furthermore, unlike MPC approaches, privacy could be easier to guarantee with trusted hardware.

## Specification

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

Below, we explain the key concepts behind how keyless accounts are implemented:

1. What is the *public key* of a keyless account?
2. How is the *authentication key* derived from this public key?
3. What does the *digital signature* look like for OIDC account transactions?

### Public keys

The **public key** of a keyless account consists of:

1. $\mathsf{iss\\_val}$: the OIDC provider’s identity, as it appears in a JWT’s `iss` field (e.g., `https://accounts.google.com`), denoted by $\mathsf{iss\\_val}$
2. $\mathsf{addr\\_idc}$: an **identity commitment (IDC)**, which is a <u>hiding</u> commitment to:
   - The owning user’s identifier issued by the OIDC provider (e.g., `alice@gmail.com`), denoted by $\mathsf{uid\\_val}$.
   - The name of the JWT field that stores the user identifier, denoted by $\mathsf{uid\\_key}$. Currently, the Typescript SDK only allows `sub` or `email`[^jwt-email-field] to protect naive developers from using the wrong JWT field. Nonetheless, the validators will accept any field, so as to not restrict power users from innovating on top of this feature.
   - The managing application’s identifier issued to it during registration with the OIDC provider (i.e., an OAuth `client_id` stored in the JWT’s `aud` field), denoted by $\mathsf{aud\\_val}$. 

A bit more formally (but ignoring complex implementation details), the IDC is computed by hashing the fields above using a SNARK-friendly hash function $H'$:

```math
\mathsf{addr\_idc} = H'(\mathsf{uid\_key}, \mathsf{uid\_val}, \mathsf{aud\_val}; r),\ \text{where}\ r\stackrel{\$}{\gets} \{0,1\}^{256}
```

### Peppers

Above, we used a (high-entropy) blinding factor $r$ to derive the IDC. This ensures that the IDC is indeed a hiding commitment to the user’s and managing application’s identity. Throughout this AIP, this blinding factor is referred to as a privacy-preserving **pepper**.

The pepper has two important properties:

1. Knowledge of the pepper $r$ will be needed when signing transactions to authorize access to the account. 
2. If the pepper is publicly-revealed, this will **not** give an attacker access to the account. In other words, unlike a secret key, the pepper does not need to remain secret in order to protect the security of the account; only the privacy of the account.

Put more simply:

- If the **pepper is lost**, then access to the **account is lost**. 
- If the **pepper is revealed** (e.g., stolen), then only **privacy of the account is lost** (i.e., the user and app identity in $\mathsf{addr\\_idc}$ can be brute-forced and ultimately revealed).

Relying on users to remember their pepper $r$ would maintain the status-quo of easy-to-lose secret-key-based accounts and thus *defeat the point of OpenID-based blockchain accounts*.

Therefore, we introduce a **pepper service** that can help users derive and remember their pepper (we discuss its properties briefly [in the appendix](#Pepper-service) and in more depth in AIP-81[^aip-81]).

### Authentication keys

Next, the **authentication key** of a keyless account is simply the hash of its public key defined above. More formally, assuming any cryptographic hash function $H$, the authentication key is:

```math
\mathsf{auth\_key} = H(\mathsf{iss\_val}, \mathsf{addr\_idc})
```

**Note:** In practice, a domain separator is also hashed in above, but for simplicity of exposition, we ignore such details.

### Secret keys

After defining the “public key” above, a natural question arises:

> What is the secret key associated with this public key?

The answer is there is no additional secret key that the user has to write down. Instead, the “secret key”, consists of the user’s ability to sign in to the OIDC account via the managing application committed in the $\mathsf{auth\\_key}$ above.

Put differently, the “secret key” can be thought of as the user’s password for that account, which the user already knows, or a pre-installed HTTP cookie which precludes the need for the user to re-enter the password. However, this **password is not sufficient**: the managing application must be available: it must allow the user to sign in to their OIDC account and receive the OIDC signature. (We discuss [how to deal with disappearing apps](#alternative-recovery-paths-for-when-managing-applications-disappear) later on.)

More formally, if a user can successfully use the application identified by $\mathsf{aud\\_val}$ to sign in (via OAuth) to their OIDC account identified by $(\mathsf{uid\\_key}, \mathsf{uid\\_val})$ and issued by the OIDC provider identified by $\mathsf{iss\\_val}$, then that ability acts as that users “secret key.”

### Signatures

We begin with a “warm-up” and describe our “leaky mode” keyless signatures which do not preserve the user’s privacy. After, we describe our “zero-knowledge” signatures which do preserve privacy.

#### _Warm-up_: Leaky signatures that reveal the user’s and app’s identity

Before describing our fully privacy-preserving TXN signatures, we warm-up by describing **leaky signatures** that reveal the identity of the user and the app: i.e., they leak $\mathsf{uid\\_key}, \mathsf{uid\\_val}$ and $\mathsf{aud\\_val}$.

A **leaky signature** $\sigma_\mathsf{txn}$ over a transaction $\mathsf{txn}$ for an address with authentication key $\mathsf{auth\\_key}$ is defined as:

```math
\sigma_\mathsf{txn} = (\mathsf{uid\_key}, \mathsf{jwt}, \mathsf{header}, \mathsf{epk}, \sigma_\mathsf{eph}, \sigma_\mathsf{oidc}, \mathsf{exp\_date}, \rho, r, \mathsf{idc\_aud\_val})
```

where:

1. $\mathsf{uid\\_key}$ is the JWT field’s name that stores the user’s identity, whose value is committed in the address IDC
2. $\mathsf{jwt}$ is the JWT payload (e.g., see [an example here](#JWT-header-and-payload-example))
3. $\mathsf{header}$ is the JWT header; indicates the OIDC signature scheme and the JWK’s key ID, which are needed to verify the OIDC signature under the correct PK
4. $\mathsf{epk}$, is an **ephemeral public key (EPK)** generated by the managing application (its associated $\mathsf{esk}$ is kept secret on the managing application side)
5. $\sigma_\mathsf{eph}$ is an **ephemeral signature** over the transaction $\mathsf{txn}$
6. $\sigma_\mathsf{oidc}$ is the OIDC signature over the full JWT (i.e.,  over the $\mathsf{header}$ and $\mathsf{jwt}$ payload)
7. $\mathsf{exp\\_date}$ is a timestamp past which $\mathsf{epk}$ is considered expired and cannot be used to sign TXN.
8. $\rho$ is a high-entropy **EPK blinder** used to create an **EPK commitment** to $\mathsf{epk}$ and $\mathsf{exp\\_date}$ that is stored in the $\mathsf{jwt}[\texttt{"nonce"}]$ field
9. $r$​ is the pepper for the address IDC, which is assumed to be zero in this "leaky mode"
10. $\mathsf{idc\\_aud\\_val}$ is an **optional** field used for [account recovery](#recovery-service). If set, this field contains the same `aud` value as in the IDC. Note that this is necessary information to include in the TXN signature during recovery, since, in that case, the $\mathsf{jwt}$ payload will contain the `aud` of the recovery service, not the `aud` committed in the IDC.

> [!TIP]
> **tl;dr**: To **verify the $\sigma_\mathsf{txn}$ signature**, validators check that the OIDC provider (1) signed the user and app IDs that are committed in the address IDC (or, the recovery service’s ID) and (2) signed the EPK which, in turn, signed the transaction, while enforcing some expiration date on the EPK.

In more detail, signature verification against the PK $(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$ involves the following:

1. If using `email`-based IDs, ensure the email has been verified:
   - i.e., if $\mathsf{uid\\_key}\stackrel{?}{=}\texttt{"email"}$, assert $\mathsf{jwt}[\texttt{"email\\_verified"}] \stackrel{?}{=} \texttt{"true"}$
1. Let $\mathsf{uid\\_val}\gets\mathsf{jwt}[\mathsf{uid\\_key}]$
1. Are we in normal mode? (i.e., is $\mathsf{idc\\_aud\\_val} \ne \bot$)
   - *Then:* let $\mathsf{aud\\_val}\gets\mathsf{jwt}[\texttt{"aud"}]$
   - *Else:*
       + let $\mathsf{aud\\_val}\gets \mathsf{idc\\_aud\\_val}$
       + assert that $\mathsf{jwt}[\texttt{"aud"}]$ is an approved recovery service ID in the [`aud` override list](#aud-override-list), stored on chain
1. Assert $\mathsf{addr\\_idc} \stackrel{?}{=} H'(\mathsf{uid\\_key}, \mathsf{uid\\_val}, \mathsf{aud\\_val}; r)$, using the pepper $r$ from the signature
1. Verify that the PK matches the authentication key on-chain:
   - Assert $\mathsf{auth\\_key} \stackrel{?}{=} H(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$
1. Check the EPK is committed in the JWT’s `nonce` field:
   - Assert $\mathsf{jwt}[\texttt{"nonce"}] \stackrel{?}{=} H’(\mathsf{epk},\mathsf{exp\\_date};\rho)$
1. Check the EPK expiration date is not too far off into the future (we detail this below):
   - Assert $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{max\\_exp\\_horizon}$, where $\mathsf{max\\_exp\\_horizon}$ is an on-chain parameter (see [here](#move-module))
   - (We do not assert the expiration date is in the future (i.e., assert $\mathsf{exp\\_date} > \mathsf{jwt}[\texttt{"iat"}]$). Instead, we assume that the JWT’s issued-at timestamp (`iat`) field is correct and therefore close to the current block time. So if an application mis-sets $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}]$, then the EPK will be expired from the perspective of the blockchain.)
1. Check the EPK is not expired:
   - Assert $\texttt{current\\_block\\_time()} < \mathsf{exp\\_date}$
1. Verify the ephemeral signature $\sigma_\mathsf{eph}$ under $\mathsf{epk}$ over the transaction $\mathsf{txn}$
1. Fetch the correct PK of the OIDC provider, denoted by $\mathsf{jwk}$, which is identified via the `kid` field in the JWT $\mathsf{header}$.
1. Verify the OIDC signature $\sigma_\mathsf{oidc}$ under $\mathsf{jwk}$ over the JWT $\mathsf{header}$ and payload $\mathsf{jwt}$.

> [!NOTE]
> **JWK consensus:** This last step that verifies the OIDC signature requires that validators **agree on the latest JWKs** (i.e., public keys) of the OIDC provider, who publishes them at a provider-specific **OpenID configuration URL**. 
>
> For this, the validators will maintain consensus on the provider’s JWKs and expose them in the `aptos_framework::jwks` Move module (see [the appendix](#jwk-consensus) and AIP-67[^aip-67]). 

> [!NOTE]
> **The need for an expiration date horizon:** We believe it would be risky for clueless dapps to set an $\mathsf{exp\\_date}$ that is too far into the future. This would create a longer time window for an attacker to compromise the signed JWT (and its associated ESK). As a result, we enforce that the expiration date is not too far into the future based on the `iat` JWT field and an “expiration horizon” $\mathsf{max\\_exp\\_horizon}$: i.e, we ensure that $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{max\\_exp\\_horizon}$.
>
> An alternative would be to ensure that $\mathsf{exp\\_date} < \texttt{current\\_block\\_time()} + \mathsf{max\\_exp\\_horizon}$. However, this is not ideal. An attacker might create an $\mathsf{exp\\_date}$ that fails the check for the current time $t_1 = \texttt{current\\_block\\_time()}$ (i.e., $\mathsf{exp\\_date} \ge t_1 + \mathsf{max\\_exp\\_horizon}$) but passes the check later on when the time becomes $t_2 > t_1$ (i.e., $\mathsf{exp\\_date} < t_2 + \mathsf{max\\_exp\\_horizon}$). This design would therefore allow for signed JWTs that appear invalid (and therefore harmless) to later become valid (and therefore attack-worthy). Relying on the `iat` avoids this issue.

**Leaky mode caveats** that will be addressed next:

- The pepper $r$ is leaked by the transaction, which allows brute-forcing of the address IDC.
- Similarly, the EPK blinder $\rho$ does not yet serve its privacy-preserving purpose since it is revealed by the TXN.
- The JWT payload is included in plaintext and leaks the identities of the managing application and user.
- Even if the JWT payload were hidden, the OIDC signature could leak these identities, since the signed JWT could be low-entropy. Therefore, an attacker could brute-force the signature verification on a small subset of likely-to-have-been-signed JWTs.

#### Zero-knowledge signatures

This gets us to the _essence of this AIP_: we are now ready to describe how privacy-preserving signatures work for our keyless accounts. These signatures leak _nothing_ about the user’s OIDC account nor the managing app’s ID associated with the accessed keyless account.

A **zero-knowledge signature** $\sigma_\mathsf{txn}$ over a transaction $\mathsf{txn}$ for an address with authentication key $\mathsf{auth\\_key}$ is defined as:

```math
\sigma_\mathsf{txn} = (\mathsf{header}, \mathsf{epk}, \sigma_\mathsf{eph}, \mathsf{exp\_date}, \mathsf{exp\_horizon}, \mathsf{extra\_field}, \mathsf{override\_aud\_val}, \sigma_\mathsf{tw}, \pi)
```

where:

3. $(\mathsf{header}$, $\mathsf{epk}$, $\sigma_\mathsf{eph}$, $\mathsf{exp\\_date})$ are [as before](#warm-up-leaky-signatures-that-reveal-the-users-and-apps-identity), except:
   - The ephemeral signature $\sigma_\mathsf{eph}$ now additionally encompasses the ZKP $\pi$, to protect against malleability attacks.

4. $\mathsf{exp\\_horizon}$, which is $\le \mathsf{max\\_exp\\_horizon}$; the $\mathsf{exp\\_date}$ must be between $\mathsf{jwt}[\texttt{"iat"}]$ and $\mathsf{jwt}[\texttt{"iat"}]+\mathsf{exp\\_horizon}$
5. $\mathsf{extra\_field}$​ is an **optional** field that is matched in the JWT and **publicly**-revealed (e.g., if the user wants to reveal their email, `extra_field` is set to `“email”:”alice@gmail.com”`)
6. $\mathsf{override\\_aud\\_val}$ is an **optional** field used for [account recovery](#recovery-service). If set, this field contains the override `aud` value (i.e., the `client_id` of the recovery service), which otherwise would be hidden by the ZKP in the JWT payload’s `aud` field. If this is set, the ZKP relation (described next) will check that this override `aud` matches the JWT’s `aud` and forego matching it to the IDC’s `aud` (similar to the leaky mode above).
7. $\sigma_\mathsf{tw}$ is an **optional** **training wheels signature** over the ZKP for the [training wheels mode](#training-wheels).
8. $\pi$ is a **zero-knowledge proof of knowledge (ZKPoK)** for the the ZK relation $\mathcal{R}$, which performs the privacy-oriented verification (discussed below).

> [!IMPORTANT]
> Note that the $\sigma_\mathsf{txn}$ transaction signature no longer contains any identifying user information (beyond the identity of the OIDC provider in $\mathsf{iss\\_val}$).

> [!TIP]
> **tl;dr**: To **verify the $\sigma_\mathsf{txn}$ signature**, validators verify a ZKPoK of an OIDC signature over (1) the user and app IDs that are committed in the address IDC (or, the recovery service’s ID) and (2) the EPK which, in turn, signed the transaction, while enforcing some expiration date on the EPK.

In more detail, signature verification against the PK $(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$ involves the following:

1. Assert $\mathsf{auth\\_key} \stackrel{?}{=} H(\mathsf{iss\\_val}, \mathsf{addr\\_idc})$, as before.

2. Check the expiration date horizon is within bounds:
   - Assert $\mathsf{exp\\_horizon} \in (0, \mathsf{max\\_exp\\_horizon})$, where $\mathsf{max\\_exp\\_horizon}$ is an on-chain parameter, as before.

3. Check the EPK is not expired:
   - Assert $\texttt{current\\_block\\_time()} < \mathsf{exp\\_date}$, as before.

4. Verify the ephemeral signature $\sigma_\mathsf{eph}$ under $\mathsf{epk}$ over the transaction $\mathsf{txn}$, as before.

5. Fetch the correct PK of the OIDC provider, denoted by $\mathsf{jwk}$​, as before.

6. Derive the **public inputs hash**:

   $$\mathsf{pih} = H_\mathsf{zk}(\mathsf{epk}, \mathsf{addr\\_idc}, \mathsf{exp\\_date}, \mathsf{exp\\_horizon}, \mathsf{iss\\_val}, \mathsf{extra\\_field}, \mathsf{header}, \mathsf{jwk}, \mathsf{override\\_aud\\_val})$$

7. If the **training wheels public key** was set on-chain (via governance; see [here](#training-wheels])), then:

   - Verify the **training wheels signature** $\sigma_\mathsf{tw}$ over the ZKP $\pi$ and the public inputs hash $\mathsf{pih}$ against 

8. Verify the ZKPoK $\pi$, which agues existence of a **secret input** $\textbf{w}$ that satisfies the **keyless ZK relation** $\mathcal{R}$ defined [next](#the-keyless-zk-relation-mathcalr).

**Zero-knowledge mode caveats** that we address later:

1. The pepper $r$ is fetched by the user/wallet from the pepper service, which we describe briefly [in the appendix](#pepper-service)
2. **Computing ZKPs is slow**. This will require a proving service, which we describe briefly [in the appendix](#(Oblivious)-ZK-proving-service)
3. **Bugs in the ZK relation implementation** can be mitigated against using the [“training wheels” mode](#training-wheels)

#### The keyless ZK relation $$\mathcal{R}$$

```math
\mathcal{R}\begin{pmatrix}
    \mathsf{pih};\\
    \textbf{w} = [
      \textbf{w}_\mathsf{pub} = (
        \mathsf{epk},
        \mathsf{addr\_idc}, 
        \mathsf{exp\_date}, 
        \mathsf{exp\_horizon}, 
        \mathsf{iss\_val}, 
        \mathsf{extra\_field}, 
        \mathsf{header}, 
        \mathsf{jwk}, 
        \mathsf{override\_aud\_val}
      ),\\
      \textbf{w}_\mathsf{priv} = (
        \mathsf{aud\_val}, 
        \mathsf{uid\_key}, 
        \mathsf{uid\_val}, 
        r,
        \sigma_\mathsf{oidc},
        \mathsf{jwt},
        \rho
      )
    ]
\end{pmatrix}
```

The **ZK relation $\mathcal{R}$** simply **performs the privacy-sensitive part of the verification** from the [leaky mode](#warm-up-leaky-signatures-that-reveal-the-users-and-apps-identity) above:

1. Verify that the public inputs hash $\mathsf{pih}$ is correctly derived by hashing the inputs in $\textbf{w}\_\mathsf{pub}$ with $H\_\mathsf{zk}$ (as explained above).
2. Check the OIDC provider ID in the JWT:
   - Assert $\mathsf{iss\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"iss"}]$
3. If using `email`-based IDs, ensure the email has been verified:
   - If $\mathsf{uid\\_key}\stackrel{?}{=}\texttt{"email"}$, assert $\mathsf{jwt}[\texttt{"email\\_verified"}] \stackrel{?}{=} \texttt{"true"}$
4. Check the user’s ID in the JWT:
   - Assert $\mathsf{uid\\_val}\stackrel{?}{=}\mathsf{jwt}[\mathsf{uid\\_key}]$
5. Check the address IDC uses the correct values:
   - Assert $\mathsf{addr\\_idc} \stackrel{?}{=} H'(\mathsf{uid\\_key}, \mathsf{uid\\_val}, \mathsf{aud\\_val}; r)$
6. Are we in normal mode (i.e., we are not in recovery mode $\Leftrightarrow \mathsf{override\\_aud\\_val} = \bot$)
   - *Then:* check the managing application’s ID in the JWT: assert $\mathsf{aud\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"aud"}]$
   - *Else:* check that the recovery service’s ID is in the JWT:  assert $\mathsf{override\\_aud\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"aud"}]$
7. Check the EPK is committed in the JWT’s `nonce` field:
   - Assert $\mathsf{jwt}[\texttt{"nonce"}] \stackrel{?}{=} H’(\mathsf{epk},\mathsf{exp\\_date};\rho)$
8. Check the EPK expiration date is not too far off into the future:
   - Assert $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{exp\\_horizon}$
9. Parse $\mathsf{extra\\_field}$ as $\mathsf{extra\\_field\\_key}$ and $\mathsf{extra\\_field\\_val}$ and assert $\mathsf{extra\\_field\\_val}\stackrel{?}{=}\mathsf{jwt}[\mathsf{extra\\_field\\_key}]$
10. Verify the OIDC signature $\sigma_\mathsf{oidc}$ under $\mathsf{jwk}$ over the JWT $\mathsf{header}$ and payload $\mathsf{jwt}$.

> [!TIP]
> Importantly, the ZK proof $\pi$ leaks nothing about the privacy-sensitive inputs in $\textbf{w}$.

> [!NOTE]
> The additional $\mathsf{exp\\_horizon}$ variable is a layer of indirection. It ensures that when the $\mathsf{max\\_exp\\_horizon}$ parameter on chain changes ZKPs do not become stale since they take $\mathsf{exp\\_horizon}$ as an input, not $\mathsf{max\\_exp\\_horizon}$.

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

### Choice of ZKP system: Groth16

Our initial deployment will use the Groth16 ZKP system[^groth16] over BN254[^bn254] elliptic curves. We chose Groth16 for several reasons:

1. Has a **small proof size** (smallest of any ZKP system): 128 bytes when using BN254 elliptic curves.
2. Has **constant verification time**: ~1.5 milliseconds on Macbook Pro M2, single threaded.
3. Has fast **proving time** (~3.5 seconds on Macbook Pro M2, with multithreading)
4. The relative ease of implementing our relation in `circom`[^circom]
5. The relatively-great tooling built around `circom`
6. It can be made **non-malleable**, which is needed for non-malleability of our TXN signatures.

Unfortunately, Groth16 is a pre-processing SNARK with a relation-specific trusted setup. This means we must coordinate an **MPC-based trusted setup ceremony** for our ZK relation $\mathcal{R}$ which is outside the scope of this AIP.

A consequence of this is that we cannot upgrade/bugfix our ZK relation implementation without redoing the setup. Therefore, in the future, we will likely transition to either a **transparent** SNARK or one with a one-time, relation-independent **universal trusted setup**.

### `keyless_account.move` Move module

Keyless accounts require an on-chain configuration for:

1. The Groth16 verification key under which the ZKP verifies
2. Circuit-specific constants
3. The training wheels public key, if any
4. The `aud` override list
5. The max # of keyless signatures allowed in a TXN (to mitigate against DoS attacks)

This configuration is stored as part of two resources in `aptos_framework::keyless_account`:

```rust
/// The 288-byte Groth16 verification key (VK) for the ZK relation that implements keyless accounts
struct Groth16VerificationKey has key, store {
    /// 32-byte serialization of `alpha * G`, where `G` is the generator of `G1`.
    alpha_g1: vector<u8>,
    /// 64-byte serialization of `alpha * H`, where `H` is the generator of `G2`.
    beta_g2: vector<u8>,
    /// 64-byte serialization of `gamma * H`, where `H` is the generator of `G2`.
    gamma_g2: vector<u8>,
    /// 64-byte serialization of `delta * H`, where `H` is the generator of `G2`.
    delta_g2: vector<u8>,
    /// `\forall i \in {0, ..., \ell}, 64-byte serialization of gamma^{-1} * (beta * a_i + alpha * b_i + c_i) * H`, where
    /// `H` is the generator of `G1` and `\ell` is 1 for the ZK relation.
    gamma_abc_g1: vector<vector<u8>>,
}

struct Configuration has key, store {
    /// An override `aud` for the identity of a recovery service, which will help users recover their keyless accounts
    /// associated with dapps or wallets that have disappeared.
    /// IMPORTANT: This recovery service **cannot** on its own take over user accounts; a user must first sign in
    /// via OAuth in the recovery service in order to allow it to rotate any of that user's keyless accounts.
    override_aud_vals: vector<String>,
    /// No transaction can have more than this many keyless signatures.
    max_signatures_per_txn: u16,
    /// How far in the future from the JWT issued at time the EPK expiry can be set.
    max_exp_horizon_secs: u64,
    /// The training wheels PK, if training wheels are on
    training_wheels_pubkey: Option<vector<u8>>,
    /// The max length of an ephemeral public key supported in our circuit (93 bytes)
    max_commited_epk_bytes: u16,
    /// The max length of the value of the JWT's `iss` field supported in our circuit (e.g., `"https://accounts.google.com"`)
    max_iss_val_bytes: u16,
    /// The max length of the JWT field name and value (e.g., `"max_age":"18"`) supported in our circuit
    max_extra_field_bytes: u16,
    /// The max length of the base64url-encoded JWT header in bytes supported in our circuit
    max_jwt_header_b64_bytes: u32,
}
```

This Move module also provides governance functions that update the `Groth16VerificationKey` and `Configuration` on-chain configs:

```rust
/// Queues up a change to the Groth16 verification key. The change will only be effective after reconfiguration.
/// Only callable via governance proposal.
///
/// WARNING: To mitigate against DoS attacks, a VK change should be done together with a training wheels PK change,
/// so that old ZKPs for the old VK cannot be replayed as potentially-valid ZKPs.
///
/// WARNING: If a malicious key is set, this would lead to stolen funds.
public fun set_groth16_verification_key_for_next_epoch(fx: &signer, vk: Groth16VerificationKey) { /* ... */ }

/// Queues up a change to the keyless configuration. The change will only be effective after reconfiguration. Only
/// callable via governance proposal.
///
/// WARNING: A malicious `Configuration` could lead to DoS attacks, create liveness issues, or enable a malicious
/// recovery service provider to phish users' accounts.
public fun set_configuration_for_next_epoch(fx: &signer, config: Configuration) { /* ... */ }

/// Convenience method to queue up a change to the training wheels PK. The change will only be effective after
/// reconfiguration. Only callable via governance proposal.
///
/// WARNING: If a malicious key is set, this *could* lead to stolen funds.
public fun update_training_wheels_for_next_epoch(fx: &signer, pk: Option<vector<u8>>) acquires Configuration { /* ... */ }

/// Convenience method to queues up a change to the max expiration horizon. The change will only be effective after
/// reconfiguration. Only callable via governance proposal.
public fun update_max_exp_horizon_for_next_epoch(fx: &signer, max_exp_horizon_secs: u64) acquires Configuration { /* ... */ }

/// Convenience method to queue up clearing the set of override `aud`'s. The change will only be effective after
/// reconfiguration. Only callable via governance proposal.
///
/// WARNING: When no override `aud` is set, recovery of keyless accounts associated with applications that disappeared
/// is no longer possible.
public fun remove_all_override_auds_for_next_epoch(fx: &signer) acquires Configuration { /* ... */ }

/// Convenience method to queue up an append to to the set of override `aud`'s. The change will only be effective
/// after reconfiguration. Only callable via governance proposal.
///
/// WARNING: If a malicious override `aud` is set, this *could* lead to stolen funds.
public fun add_override_aud_for_next_epoch(fx: &signer, aud: String) acquires Configuration { /* ... */ }
```

#### `aud` override list

Note that, to support the [recovery service (discussed later on)](#recovery-service), the Move module maintains a list of `aud` overrides inside the `Configuration`. As explained in the [“Signatures”](#signatures) and [“Recovery service”](#recovery-service) sections, OIDC signatures for these `aud`'s can be used to access keyless accounts associated with *any* `client_id`, which allows for account recovery when a dapp disappears.

### Rust structs

A keyless public key is defined as:

```rust
pub struct KeylessPublicKey {
    /// The value of the `iss` field from the JWT, indicating the OIDC provider.
    /// e.g., https://accounts.google.com
    pub iss_val: String,

    /// SNARK-friendly commitment to:
    /// 1. The application's ID; i.e., the `aud` field in the signed OIDC JWT representing the OAuth client ID.
    /// 2. The OIDC provider's internal identifier for the user; e.g., the `sub` field in the signed OIDC JWT
    ///    which is Google's internal user identifier for bob@gmail.com, or the `email` field.
    ///
    /// e.g., H(aud || uid_key || uid_val || pepper), where `pepper` is the commitment's randomness used to hide
    ///  `aud` and `sub`.
    pub idc: IdCommitment,
}

pub struct IdCommitment(#[serde(with = "serde_bytes")] pub(crate) Vec<u8>);
```

A keyless signature is defined as:

```rust
pub struct KeylessSignature {
    pub cert: EphemeralCertificate,

    /// The decoded/plaintext JWT header (i.e., *not* base64url-encoded), with two relevant fields:
    ///  1. `kid`, which indicates which of the OIDC provider's JWKs should be used to verify the
    ///     \[ZKPoK of an\] OpenID signature.,
    ///  2. `alg`, which indicates which type of signature scheme was used to sign the JWT
    pub jwt_header_json: String,

    /// The expiry time of the `ephemeral_pubkey` represented as a UNIX epoch timestamp in seconds.
    pub exp_date_secs: u64,

    /// A short lived public key used to verify the `ephemeral_signature`.
    pub ephemeral_pubkey: EphemeralPublicKey,

    /// A signature ove the transaction and, if present, the ZKP, under `ephemeral_pubkey`.
    /// The ZKP is included in this signature to prevent malleability attacks.
    pub ephemeral_signature: EphemeralSignature,
}

pub enum EphemeralCertificate {
    ZeroKnowledgeSig(ZeroKnowledgeSig),
    OpenIdSig(OpenIdSig),
}

pub struct ZeroKnowledgeSig {
    pub proof: ZKP,
    /// The expiration horizon that the circuit should enforce on the expiration date committed in
    /// the nonce. This must be <= `Configuration::max_expiration_horizon_secs`.
    pub exp_horizon_secs: u64,
    /// An optional extra field (e.g., `"<name>":"<val>") that will be matched publicly in the JWT
    pub extra_field: Option<String>,
    /// Will be set to the override `aud` value that the circuit should match, instead of the `aud`
    /// in the IDC. This will allow users to recover keyless accounts bound to an application that
    /// is no longer online.
    pub override_aud_val: Option<String>,
    /// A signature on the proof and the statement (via the training wheels SK) to mitigate against
    /// flaws in our circuit.
    pub training_wheels_signature: Option<EphemeralSignature>,
}

pub struct OpenIdSig {
    /// The decoded bytes of the JWS signature in the JWT (https://datatracker.ietf.org/doc/html/rfc7515#section-3)
    #[serde(with = "serde_bytes")]
    pub jwt_sig: Vec<u8>,
    /// The decoded/plaintext JSON payload of the JWT (https://datatracker.ietf.org/doc/html/rfc7519#section-3)
    pub jwt_payload_json: String,
    /// The name of the key in the claim that maps to the user identifier; e.g., "sub" or "email"
    pub uid_key: String,
    /// The random value used to obfuscate the EPK from OIDC providers in the nonce field
    #[serde(with = "serde_bytes")]
    pub epk_blinder: Vec<u8>,
    /// The privacy-preserving value used to calculate the identity commitment. It is typically uniquely derived from `(iss, client_id, uid_key, uid_val)`.
    pub pepper: Pepper,
    /// When an override aud_val is used, the signature needs to contain the aud_val committed in the
    /// IDC, since the JWT will contain the override.
    pub idc_aud_val: Option<String>,
}

pub enum EphemeralPublicKey {
    Ed25519 {
        public_key: Ed25519PublicKey,
    },
    Secp256r1Ecdsa {
        public_key: secp256r1_ecdsa::PublicKey,
    },
}

pub enum EphemeralSignature {
    Ed25519 {
        signature: Ed25519Signature,
    },
    WebAuthn {
        signature: PartialAuthenticatorAssertionResponse,
    },
}
```

### PRs

We will add more links to our circuit code and Rust TXN authenticator below:
 - [Rust authenticator code for the leaky mode](https://github.com/aptos-labs/aptos-core/pull/11681)
 - [Rust authenticator code for the Groth16-based ZKP mode](https://github.com/aptos-labs/aptos-core/pull/11772)
 - [Fetch the Groth16 VK from on-chain](https://github.com/aptos-labs/aptos-core/pull/11895)
 - [Properly handle exp_horizon + VK & Configuration initialization in Rust](https://github.com/aptos-labs/aptos-core/pull/11966)
 - [Optional training wheels signature](https://github.com/aptos-labs/aptos-core/pull/11986)
 - [Fix smoke tests](https://github.com/aptos-labs/aptos-core/pull/11994)
 - [base10 string for nonce](https://github.com/aptos-labs/aptos-core/pull/12001)
 - [Remove uid_key restriction](https://github.com/aptos-labs/aptos-core/pull/12007)
 - [Optimize `iss` storage & refactor](https://github.com/aptos-labs/aptos-core/pull/12017)
 - [Rename to AIP-61 terminology](https://github.com/aptos-labs/aptos-core/pull/12123)
 - [Rename to keyless](https://github.com/aptos-labs/aptos-core/pull/12285)
 - [base64 fixes, training wheels signature fixes](https://github.com/aptos-labs/aptos-core/pull/12287)
 - [Custom hex serialization for some keyless structs](https://github.com/aptos-labs/aptos-core/pull/12295)
 - [e2e tests for feature gating](https://github.com/aptos-labs/aptos-core/pull/12296)
 - [Support for passkey-based EPKs & non-malleability signature fixes](https://github.com/aptos-labs/aptos-core/pull/12333)
 - [Update verification key & test proof](https://github.com/aptos-labs/aptos-core/pull/12413)
 - [Fix public inputs hash generation, fix serde deserialization, add Google as default OIDC provider in devnet](https://github.com/aptos-labs/aptos-core/pull/12476/files)
 - [Fix feature gating & match alg fields](https://github.com/aptos-labs/aptos-core/pull/12521)

## Testing (Optional)

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out)
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

### Correctness and soundness of signature verification

- <u>Unexpired</u> [ZKPoKs of] OIDC signatures from supported providers 
- <u>Expired</u> [ZKPoKs of] OIDC signatures from supported providers do NOT verify.
- Signatures from **un**supported providers do NOT verify.
- [ZKPoKs of] OIDC signatures *without* an ephemeral signature fail validation.
- ZKPs are not malleable.

### Other tests

- Test that transactions which include a large number of OIDC accounts validate quickly.

We will expand later on the testing plan. **(TBA.)**

## Risks and Drawbacks

 > - Express here the potential negative ramifications of taking on this proposal. What are the hazards?
 > - Any backwards compatibility issues we should be aware of?
 > - If there are issues, how can we mitigate or resolve them

All the risk and drawbacks are described in the [“Security, Liveness and Privacy Considerations” section](#Security-Liveness-and-Privacy-Considerations).

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

Specifically, with training wheels on, a break in our ZK relation implementation will not result in a catastrophic loss of funds for our users. At the same time, a compromised proving service cannot steal funds on its own: it must still compromise the victim’s OIDC account and obtain a valid OIDC signature for it.

An important **liveness consideration** of this is that if the proving service is down, users will not be able to access their accounts. Nonetheless, if outages do happen we expect them to be brief and a price worth paying for securing our initial deployment.

The training wheels public key will be stored as on on-chain parameter in the `aptos_framework::keyless_account::Configuration` resource (see [here](#keyless_accountmove-move-module)) and can be changed via governance.

> [!NOTE]
> The training wheels mode also acts as a **DoS prevention layer**, since invalid ZKPs will never be signed by the prover service. As a result, since our Rust validation code first verifies the training wheels signature, it easily dismisses invalid ZKPs without having to waste cycles verifying them.
>
> An important implementation detail is that the if the Groth16 verification key (VK) is changed, the training wheels public key (twPK) must be changed too, since the training wheels signature does not currently encompass the VK. Forgetting to change the twPK could potentially allow an attacker to DoS by replaying old ZK proofs under the old VK.

### Recovery service

Recall that keyless accounts are bound not just to the user but also to a managing application (e.g., a dapp or a wallet).

Unfortunately, this **managing application could disappear**. For example:

1. Its OAuth `client_id` might be banned by the OIDC provider (for various reasons)
2. An incompetent administrator loses the application’s OAuth `client_secret` or deletes the registered application from the OIDC provider
3. A clueless administrator simply takes down the application (e.g., removes a mobile phone app from the app store or stops running the dapp’s website) without realizing that its users will lose access to their keyless account on that application.

In other words, **if the managing application disappears, then users would no longer be able to access their keyless account(s) associated with it**, since they would no longer be able to obtain a signed JWT without the application.

Fortunately, the **recovery service** can help avoid such account loss, by helping users re-gain access to their accounts. Specifically, 

1. A user will sign in into the recovery service via their OIDC provider. 
2. The recovery service will obtain an OIDC signature over its `client_id` and the user’s `sub`. 
3. The recovery service’s `client_id` will be on the [`aud` override list](#aud-override-list), from a past successful governance proposal.
4. The blockchain validators will accept this [ZKPoK of an] OIDC signature as a valid keyless signature for *any* managing application.
5. As a result, the user can authorize a key rotation for their inaccessible account(s) using this [ZKPoK of an] OIDC signature.

> [!WARNING]
> The recovery path will work only if the `client_id` of the recovery service is added, via governance, to the on-chain [`aud` override list](#aud-override-list).

The **advantages** of this approach are:

1. It minimizes centralization risks, since the recovery service’s `client_id` can be set via governance proposal.
2. Multiple such recovery services can be added and users can interact with the one they trust most.
3. The recovery service is stateless and does not store signed JWTs of previously-logged in users.
4. A dishonest recovery service cannot, on its own, rotate the accounts of a user. The user must first sign in into the recovery service.

A **disadvantage** of this approach is that if a user signs into an **actively-malicious** recovery service, that service can steal all of that user’s keyless accounts. So users must be vigilant about which recovery service they use.

To mitigate this problem, it may be possible to distribute a recovery service via MPC techniques. This would ensure that the signed JWT cannot be stolen by a colluding minority of the servers. This is left as future work.

#### Other recovery paths

While **alternative recovery paths** are possible, they either suffer from poor UX, are prone to phishing attacks, do not work on all platforms, or require centralization:

- For **email-based** OIDC providers, we can replace the ZKPoK of an OIDC signature with a ZKPoK of a DKIM-signed email[^zkemail] (with a properly-formatted message). 
  - While this will be less user-friendly, it provides emergency recovery and continues to **preserve privacy**.
  - It would be important to make sure this flow is **hard-to-phish**, since users might be tricked into sending such “account reset” emails by attackers.
  - For example, this flow could only be allowed if the account has been inactive for a long period of time. 
  - And/or, this flow might require the user to engage with another decentralized verification party which properly walks the user through an account reset flow.
- For **non-email-based** OIDC providers, alternative recovery paths could be provider-specific:
  - For **Twitter**, a user could prove they own their Twitter account by tweeting a specially-crafted message
  - Similarly, for **GitHub**, users could do the same by posting a gist.
  - Given an HTTPS oracle, validators could verify such a tweet or a gist and allow the user to rotate their account's key. This would **not** be **privacy-preserving** since, at minimum, the validators would learn the user’s identity from the HTTPS URL.
  - This flow is also susceptible to phishing.
- Alternatively, all keyless accounts could be set up as a 1-out-of-2 account[^multiauth] with a **recovery [passkey](#Passkeys)** sub-account. This way, the passkey, if backed up automatically (e.g., on Apple platforms), could be used to restore access to the account.
  - A traditional SK sub-account could also be used but this would require the managing application to prompt users to write down the SK, which defeats the user-friendliness goals from [here](#goals).

- Alternatively, for popular applications, we could consider **manual patches**: e.g., adding an override for their `client_id` in our ZK relation. (But this brings about a centralization risk.)

### Compromised OIDC account

The whole point of keyless accounts is to make a user’s blockchain account **as secure as their OIDC account**. Naturally, if the OIDC account (e.g., Google) is compromised, all keyless accounts associated with that user’s OIDC account will be vulnerable 

In fact, even though the OIDC account might be **temporarily** compromised, the keyless account could be **permanently** compromised, since an attacker can simply rotate the account’s key in the brief window it has access to the underlying OIDC account.

Nonetheless, this is the intended security model: *“your blockchain account = your Google account”*!

Users who are not comfortable with this model, can either (1) not use this feature at all or (2) use `t`-out-of-`n` approaches[^multiauth] where one of the `n` factors is a keyless account, based on their preference.

> [!NOTE]
> The pepper service also uses the OIDC account for authenticating requests, so the pepper cannot be meaningfully be used as 2nd factor; at least not without defeating the point of keyless accounts, which is to preclude the need for users to remember any information.

### Compromised OIDC provider

Recall that _“your blockchain account = your OIDC account.”_ In other words:

- If your OIDC account is compromised, so is your keyless account.
- If your OIDC provider (e.g., Google) is compromised, so is your keyless account associated with that provider.

We stress that this is a **feature**, not a **bug**: we want Aptos users to leverage the security & user-friendliness of their OIDC accounts to transact easily. Nonetheless, for users who do not want to fully rely on the security of their OIDC account, they can upgrade to a $t$ out of $n$ approach, using a combination of different OIDC accounts and/or traditional SKs[^multiauth].

> [!NOTE]
> We can mitigate against a compromised OIDC provider by revoking their JWK using an emergency governance proposal.

### OIDC providers switch to unsupported signature scheme

Our currently-implemented ZK relation only supports RSA signature verification due to its popularity amongst OIDC providers. However, if a provider suddenly switches to another scheme (e.g., Ed25519), users will no longer be able to construct ZKPs and access their accounts.

In the unlikely case that this happens, we can proceed as follows:

1. First, we enable the **leaky mode** via a feature flag. This restores access to users accounts, albeit without privacy, and should put most users at ease that their assets are safe.
2. Second, we upgrade the ZK relation to support the new scheme, perform a short-lived trusted setup, and deploy it to production.

### Web-based wallets and walletless dapps

Keyless accounts will give rise to (1) web-based wallets that users can sign into via (say) Google and (2) **walletless dapps** that users can sign into directly via (again, say) Google.

There are several security challenges in the web environment:

- Making sure JavaScript dependencies are not hijacked, which could lead to exfiltration of ESKs, signed JWTs or both.
- Managing the ESKs of user accounts in the browser can be risky, since they might leak due to JavaScript caching or being improperly stored.
  - Fortunately, the Web Crypto API and/or using a passkey as the ESK should address these concerns.
- Protecting against cross-site scripting (XSS) and cross-site request forgery (CSRF) attacks
- Managing JWTs in the browser can be risky, especially if the OAuth implicit flow is used, since JWTs can become part of URLs and the HTTP `Referer` field, which could easily leak. Application developers should be particularly careful.

### SNARK-friendly hash functions

To ensure reasonable proving times, we use the *Poseidon*[^poseidon] SNARK-friendly hash function[^snark-hash]. Unfortunately, Poseidon has not received as much cryptanalysis as older hash functions like SHA2-256.

If collisions attacks on Poseidon are found, an attacker could change the committed user or app ID and steal funds without having to break the ZKP system nor the OIDC provider.

In the long-term, we plan on moving away from SNARK-friendly hash functions and choosing our zkSNARK proof system to remain efficient even when used with SNARK-unfriendly hash functions like SHA2-256.

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

### Set of providers with secure alternative recovery paths

An important question for deployment is what set of OIDC providers admit a secure alternative recovery path (e.g., a flow that is not easy to phish)?

### Where should webapp developers store the ESK and signed JWT by default?

For mobile phone apps, storing the ESK is not a concern: everything will be stored in the app’s storage.

However, for webapps (e.g., dapps or web-wallets) there are two options:

1. Use the **OAuth implicit grant flow** and store both the ESK and the signed JWT in the browser (e.g., local storage, `IndexedDB`). 
   - This way, even if a dapp/web-wallet backend is compromised, the user’s assets cannot be stolen unless the user visits the compromised website and triggers execution of malicious JavaScript.
2. Use the **OAuth authorization grant flow** and store the ESK in the browser and the signed JWT in the backend.
   - Unfortunately, some OIDC providers allow refreshing the signed JWT from the backend on a new `nonce` field, without the user’s consent. This means a compromised backend can refresh the signed JWT on an EPK it controls and steal keyless accounts (assuming the OAuth session has not expired). This can be done without the user’s involvement in accessing the compromised website.

### What should $\mathsf{max\\_exp\\_horizon}$ be set to?

Recall that the $\mathsf{exp\\_date}$ cannot exceed $\mathsf{jwt}[\texttt{"iat"}]+\mathsf{max\\_exp\\_horizon}$.

Constraints:

- Cannot be too short, since this would require refreshing the signed JWTs too often, which in turn would require recomputing the ZKPs too often.

- Cannot be too long, since this increases the window in which a signed JWT and its committed ESK can be stolen.

### Zero-knowledge TXNs still leak the OIDC provider’s identity

Currently, zero-knowledge TXNs leak which OIDC provider is involved by revealing the $\mathsf{iss\\_val}$ field  (e.g., Google, GitHub).

However, we could modify our ZK relation to hide the OIDC provider too. Specifically, instead of taking in the $\mathsf{jwk}$ as a *public* input, the relation would take it as a *private* input, and then would verify membership of this JWK in a list of approved JWKs committed on chain. (Otherwise, users can input any JWK and forge TXN signatures.)

## Appendix

### OpenID Connect (OIDC)

The [OIDC specification](https://openid.net/specs/openid-connect-core-1_0.html) says:

 - The `iat` field must be specified in seconds since the UNIX epoch time ([here](https://openid.net/specs/openid-connect-core-1_0.html#IDToken)).
 - The refresh protocol does **NOT** allow setting a new nonce ([here]([url](https://openid.net/specs/openid-connect-core-1_0.html#RefreshTokenResponse))). However, in our experiences, providers like Google do allow users to refresh their OIDC signatures on a new `nonce`.

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

Its design can be found in AIP-81[^aip-81], but here we highlight some of its key properties:

- Much like the blockchain validators, the service **authenticates the user** before revealing their pepper to them
  - Authentication will be done via the same OIDC signatures used to create TXN signatures.

- The service computes peppers using a **verifiable random function (VRF)**
- This makes the service simple to **decentralize**, either as its own separate system or on top of Aptos validators.
- The pepper service will be **privacy-preserving**: it will learn neither (1) the identity of the user requesting their pepper nor (2) the actual pepper that it computed for that user.
- The pepper service will be mostly “**stateless**”, in the sense that it will only store the VRF secret key from which it will derive users’ peppers.

### (Oblivious) ZK proving service

As long as the ZKP proving overhead in the browser and on mobile phones remains high, there will be a **ZK proving service** to help users compute their ZKPs fast. 

Its design is described in AIP-75[^aip-75], but here we highlight some of its key properties:

- It cannot steal a user’s keyless account; not without compromising the associated OIDC account first.
  
- If the service is down, users can still access their account (although more slowly), since they can always compute ZKPs on their own.
  - Unless the proving service is operating with “training wheels” on (see [below](#training-wheels))

- It should be **decentralized**, either in a permissioned or permissionless fashion.
- It should be difficult to attack via **denial of service (DoS)** attacks
- It should be **oblivious** or **privacy-preserving**: it will not learn anything about the private input in the ZK relation (e.g., the identity of the user requesting a proof, the pepper for that user, etc.)
- The proving service will be mostly “**stateless**”, in the sense that it will only store a public proving key needed to compute ZKPs for our ZK relation $\mathcal{R}$.

### JWK consensus

Transaction signatures for keyless accounts involve verifying an OIDC signature. This requires that validators **agree on the latest JWKs** (i.e., public keys) of the OIDC provider, which are periodically-updated at a provider-specific **OpenID configuration URL**. 

The design and implementation of JWK consensus is described in AIP-67[^aip-67], but here we highlight some of its key properties:

- The validators will frequently scan for JWK changes at every supported provider’s **OpenID configuration URL**
- When a change is detected by a validator, that validator will propose the change via a one-shot consensus mechanism
- Once the validators agree, the new JWKs will be reflected in a public Move module in `aptos_framework::jwks`.

## Changelog

- _2024-02-29_: An [earlier version](https://github.com/aptos-foundation/AIPs/blob/71cc264cc249faf4ac23a3f441fb76a64278b51a/aips/aip-61.md) of this AIP referred to keyless accounts as **OpenID-based blockchain (OIDB)** accounts.
- _2024-03-14_: Added Rust structs for keyless signatures and public keys.
- _2024-03-14_: Augmented the keyless TXN signatures to account for the recovery service functionality and the extra public field functionality.
- _2024-05-08:_ Several updates
  - Introduced the [recovery service](#recovery-service) as the main route of dealing with disappearing dapps/wallets
  - Updated the ZK relation $$\mathcal{R}$$ with the latest details (`aud` override, `extra_field`, public inputs hash)
  - Updated passkey, MPC and HSM comparison
  - Introduced the training wheels signature
  - Added Rust and Move code samples.
  - Added links to related AIPs (e.g., pepper service, prover service, JWK consensus)


## References

[^aip-67]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-67.md
[^aip-75]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-75.md
[^aip-81]: https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-81.md
[^bn254]: https://hackmd.io/@jpw/bn254
[^bonsay-pay]: https://www.risczero.com/news/bonsai-pay
[^circom]: https://docs.circom.io/circom-language/signals/
[^eip-7522]: **EIP-7522: OIDC ZK Verifier for AA Account**, by dongshu2013, [[URL]](https://eips.ethereum.org/EIPS/eip-7522)
[^groth16]: **On the Size of Pairing-Based Non-interactive Arguments**, by Groth, Jens, *in Advances in Cryptology -- EUROCRYPT 2016*, 2016
[^HPL23]: **The OAuth 2.1 Authorization Framework**, by Dick Hardt and Aaron Parecki and Torsten Lodderstedt, 2023, [[URL]](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/08/)
[^jwt-email-field]: Use of the `email` field will be restricted to OIDC providers that never change its value (e.g., email services like Google), since that ensures users cannot accidentally lock themselves out of their blockchain accounts by changing their Web2 account’s email address.
[^multiauth]: See [AIP-55: Generalize Transaction Authentication and Support Arbitrary K-of-N MultiKey Accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)
[^multisig]: There are alternatives to single-SK accounts, such as multisignature-based accounts (e.g., via [MultiEd25519](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-stdlib/sources/cryptography/multi_ed25519.move) or via [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)), but they still bottle down to one or more users protecting their secret keys from loss or theft.
[^nozee]: https://github.com/sehyunc/nozee
[^oauth-playground]: https://developers.google.com/oauthplayground/
[^openpubkey]: **OpenPubkey: Augmenting OpenID Connect with User held Signing Keys**, by Ethan Heilman and Lucie Mugnier and Athanasios Filippidis and Sharon Goldberg and Sebastien Lipman and Yuval Marcus and Mike Milano and Sidhartha Premkumar and Chad Unrein, *in Cryptology ePrint Archive, Paper 2023/296*, 2023, [[URL]](https://eprint.iacr.org/2023/296)
[^openzeppelin]: **Sign in with Google to your Identity Contract (for fun and profit)**, by Santiago Palladino, [[URL]](https://forum.openzeppelin.com/t/sign-in-with-google-to-your-identity-contract-for-fun-and-profit/1631)
[^poseidon]: **Poseidon: A New Hash Function for Zero-Knowledge Proof Systems**, by Lorenzo Grassi and Dmitry Khovratovich and Christian Rechberger and Arnab Roy and Markus Schofnegger, *in USENIX Security’21*, 2021, [[URL]](https://www.usenix.org/conference/usenixsecurity21/presentation/grassi)
[^snark-hash]: https://www.taceo.io/2023/10/10/how-to-choose-your-zk-friendly-hash-function/
[^snark-jwt-verify]: https://github.com/TheFrozenFire/snark-jwt-verify/tree/master
[^webauthn-prf]: https://github.com/w3c/webauthn/wiki/Explainer:-PRF-extension
[^zk-blind]: https://github.com/emmaguo13/zk-blind
[^zkaa]: **Beyond the Blockchain Address: Zero-Knowledge Address Abstraction**; by Sanghyeon Park and Jeong Hyuk Lee and Seunghwa Lee and Jung Hyun Chun and Hyeonmyeong Cho and MinGi Kim and Hyun Ki Cho and Soo-Mook Moon; _in Cryptology ePrint Archive, Paper 2023/191_; 2023; [[URL]](https://eprint.iacr.org/2023/191)
[^zkemail]: https://github.com/zkemail
[^zklogin]: https://docs.sui.io/concepts/cryptography/zklogin
