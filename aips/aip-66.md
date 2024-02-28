---
aip: 66
title: Passkey Accounts
author: hariria
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/322
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedback and reviews>
type: Standard (Core/Framework)
created: 12/14/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-66 - Passkey Accounts

## Summary

This AIP proposes the first [WebAuthn](https://www.w3.org/TR/webauthn-3/) Authenticator for Aptos, enabling users to utilize passkeys and other WebAuthn credentials for transaction authentication.

[Passkeys](https://fidoalliance.org/passkeys/) are designed to replace passwords as a phishing resistant, faster, and more secure form of user authentication. When a user registers a passkey, a new website-specific [public key credential](https://www.w3.org/TR/webauthn-3/#public-key-credential) is created on their device's [authenticator](https://www.w3.org/TR/webauthn-3/#authenticator). WebAuthn Authenticators securely store passkeys and enable users to access them via [authorization gestures](https://www.w3.org/TR/webauthn-3/#authorization-gesture) like Face ID or Touch ID. In future sessions with that website, the passkey can be used instead of a password to produce a digital signature that validates the identity of the user.

On Aptos, passkey transactions are authenticated via a [WebAuthn](https://www.w3.org/TR/webauthn-3/)-specific [`AccountAuthenticator`](#transaction-submission). Aptos currently supports NIST P256 (`secp256r1`) as the only valid WebAuthn signature scheme because of its broad support across most modern operating systems. The WebAuthn [`AccountAuthenticator`](#transaction-submission) enables Aptos users to sign and submit transactions with any compatible WebAuthn credential, including multi-device credentials registered on iOS, MacOS, and Android devices, as well as single-device, hardware-bound credentials on devices like Yubikeys.

## Motivation

Blockchains have revolutionized digital asset ownership by providing users with the ability to fully control their account without a centralized custodian. This decentralized model, however, has drawbacks. If the user self-custodies their keys, they are fully responsible for the management of their account and there is no recovery path if users lose their private key.

Passkeys enable a user to seamlessly onboard into Web3 by offering a mechanism to create and recover an account without relying on plaintext mnemonics or private keys. Specifically, passkeys within the Apple or Android ecosystems can easily be recovered or sync to new devices, so long as that device exists within the same ecosystem (e.g., iOS and MacOS devices can sync passkeys via iCloud). Further opportunities for recoverability exist within Aptos with its native key rotation and support for K-of-N multikey accounts, as discussed in [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md).

## Goals

The objectives of this AIP are twofold:

1. To enable users on Aptos to create an on-chain account associated with their WebAuthn credential
2. To enable users on Aptos to sign transactions with a WebAuthn credential

## Impact

This AIP will benefit developers and users by providing them with an easy way to create non-phishable, recoverable private keys.

1. **User-friendliness:**
   1. WebAuthn credential registration (private key creation) and transaction signing can be done simply via user authentication such as device biometrics
   2. Enables users to interact with dapps via their Passkey accounts, without having to install a mobile or extension wallet: i.e., a **headless wallet experience**.
   3. By storing the private key securely in the WebAuthn Authenticator instead of browser storage (e.g., localstorage), passkeys eliminate the need for setting up a wallet password, traditionally required for encrypting private keys in the browser.
   4. On certain operating systems, the passkey is backed up and syncs seamlessly with multiple devices (see [backup eligibility](#backup-state-and-eligiblity )).

2. **Security:**
   1. With passkeys, the private key is not stored in browser storage (e.g., localStorage) where it could potentially be accessed by a malicious party either through physical access on the device or supply chain attacks via a malicious dependency.
   2. By default, passkeys provide a consent-driven signing experience and prompt the user to authenticate every time they sign, similar to Apple Pay or Google Pay.
   3. Passkeys are bound to a relying party (e.g., a website like a web-based wallet) and are not phishable.

## Alternative solutions

See the section on **Alternative Solutions** in [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#alternative-solutions) for a more in-depth exploration into the respective tradeoffs of multi-party computation (MPC), hardware security modules (HSMs), and OpenID blockchain (OIDB) accounts.

### OIDB Accounts

OIDB accounts present a unique and novel way to generate an on-chain account with an OpenID account. This is highly desirable as OIDB accounts are accessible across all devices with browsers. Additionally, most people have an account associated with one or more OIDC providers (e.g., Google) and are familiar with OAuth login flows. Lastly, recoverability is not limited to certain operating systems in the same way that passkeys are.

On the other hand, there are tradeoffs to consider as well:

1. There are centralization and liveness concerns both on the OIDC provider and the services needed for OIDB accounts to function in a privacy preserving manner (e.g., pepper service, proving service) respectively.
2. Unless the ephemeral secret key ($\mathsf{esk}$) associated with the OIDB account of the user is encrypted (i.e., with a password) or is a passkey itself, the plaintext ephemeral secret key is still available on the browser, leaving it potentially vulnerable to a malicious actor (but only during its short expiration window). Passkey private keys, on the other hand, are often stored securely within an authenticator on the device and end-to-end encrypted during backup.

## User Flow Overview

The goal of this AIP is not to prescribe the method for integrating passkeys into your Aptos application; however, for demonstration purposes, here is an example of how one might use a passkey for transaction signing with a website.

Suppose a new user, Alice, wants to create an account on Aptos and use that account to send money to her friend, Bob.

1. Alice visits a wallet website and creates an account.
2. During account creation, the wallet prompts Alice to register a passkey for the site.
3. Alice consents via an authorization gesture (biometric authorization, such as Face ID or Touch ID) and creates a passkey that is bound to that wallet website.
4. The wallet generates an Aptos address from Alice's passkey public key.
5. Alice transfers some APT to her address to create the account on chain.
6. On the web wallet, Alice signs a transaction to send 1 APT to Bob's address.
7. The dApp requests Alice to sign the transaction via her passkey.
8. Alice consents via an authorization gesture (biometric authorization, such as Face ID or Touch ID).
9. The transaction (with the passkey signature and public key) is successfully submitted to the Aptos blockchain, and the APT is transferred to Bob's account.

## Specification

Passkeys use the [WebAuthn specification](https://www.w3.org/TR/webauthn-3/), a standard co-created by the [FIDO alliance](https://fidoalliance.org/) and the [World Wide Web Consortium (W3C)](https://www.w3.org/), for passkey registration and authentication. Below, this AIP discusses the ways in which the WebAuthn specification is used for transaction authentication on Aptos.

### Terminology

- [**OIDB account**](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md): An OpenID blockchain (OIDB) account whose security and liveness is backed by an OIDC account (e.g., a Google account) rather than a secret key.
- [**Relying party**](https://www.w3.org/TR/webauthn-3/#relying-party): The website, application, or service that the user is trying to access, which is responsible for verifying a signature from the user's passkey to ensure that the user is who they claim to be. For simplicity, we can say that a "relying party" is synonymous with a **wallet** in this context since both are responsible for managing the user's access to a private key.
- [**WebAuthn Authenticator**](https://www.w3.org/TR/webauthn-3/#authenticator): A cryptographic entity, existing in hardware or software, that can register a user with a given relying party and later assert possession of the registered public key credential, and optionally verify the user to the relying party.
- [**Account Authenticator**](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md#summary): Authorizes the execution of a transaction on Aptos by the set of senders or approvers of the accounts within the transaction.


### Aptos Account Creation with Passkeys

During the registration of a new WebAuthn credential, an asymmetric key (i.e., a **private key** and its associated **public key**) is generated securely via the WebAuthn Authenticator on that device. The public key associated with the WebAuthn credential can be used to derive an associated account on chain. The private key, which controls the account, will be secured by the WebAuthn Authenticator on the device.

The registration process is particularly important for several reasons:

1. The public key associated with the credential is only revealed during registration. Assertion responses (signing with the passkey) do NOT return the public key. Thus, the registration response must be parsed and the relevant information about the credential should be stored properly and persisted in the backend by the wallet.
2. The registration response includes `flags` that describe the backup characteristics of the credential. If passkey backup is an important consideration, these flags should be evaluated **BEFORE** the on-chain account is created.

#### [`PublicKeyCredentialCreationOptions`](https://www.w3.org/TR/webauthn/#dictdef-publickeycredentialcreationoptions)

Every WebAuthn credential is created by the wallet with a set of options, called `PublicKeyCredentialCreationOptions`. These options help configure many aspects of the WebAuthn credential, including, but not limited to:

- The asymmetric key type for the credential (`Ed25519`, `ECDSA`, `RSA`, etc.)
- User verification requirements during assertions
- Whether the WebAuthn credential should be bound to one device or available cross-platform. 

It's important to carefully consider which options to select as they have significant impacts on the passkey user experience and **CANNOT** be reconfigured after credential creation.

Some fields in `PublicKeyCredentialCreationOptions` have been highlighted below.

**[`PublicKeyCredentialParameters`](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialparameters)**

To make a WebAuthn credential compatible with Aptos, the `pubKeyCredParams` array should only contain supported signature schemes. At the present moment, only `secp256r1` is supported, which requires that the array have one element with `alg: -7` to denote `secp256r1` as the choice of credential type.

**[`PublicKeyCredentialUserEntity`](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialuserentity)**

Each authenticator stores a [credentials map](https://www.w3.org/TR/webauthn-3/#authenticator-credentials-map), a map from ([`rpId`](https://www.w3.org/TR/webauthn-3/#public-key-credential-source-rpid), [[`userHandle`](https://www.w3.org/TR/webauthn-3/#public-key-credential-source-userhandle)]) to public key credential source. For context, a [user handle](https://www.w3.org/TR/webauthn-3/#user-handle) is a unique id for the credential, similar to a `credentialId`, but chosen by the wallet instead of the WebAuthn Authenticator. If the user creates another credential with the same `userHandle` as an existing credential on that authenticator (on that user's device/platform), it will **OVERWRITE** the existing credential, thus overwriting the private key associated with a passkey account. To avoid this, it is **IMPERATIVE** for the wallet to maintain a list of previously registered credentials and corresponding user handles.

#### Registration Response

After successfully registering the credential, the authenticator will return a [`PublicKeyCredential`](https://www.w3.org/TR/webauthn-3/#publickeycredential). In the `PublicKeyCredential` will be a `response` field of type [`AuthenticatorAttestationResponse`](https://www.w3.org/TR/webauthn-3/#authenticatorattestationresponse) which will contain most of the information needed for verification of the registration response.

Fully decoding the `response` field in `PublicKeyCredential` yields an `AuthenticatorAttestationResponse`. A rust representation of it is included below:

```rust [code reference](https://github.com/1Password/passkey-rs/blob/c23ec42da5d3a9399b358c5d38f4f5b02f48b792/passkey-types/src/webauthn/attestation.rs#L497)
pub struct AuthenticatorAttestationResponse {
    /// This attribute contains the JSON serialization of [`CollectedClientData`] passed to the
    /// authenticator by the client in order to generate this credential. The exact JSON serialization
    /// MUST be preserved, as the hash of the serialized client data has been computed over it.
    #[serde(rename = "clientDataJSON")]
    pub client_data_json: Bytes,

    /// This is the authenticator Data that is contained within the Attestation Object.
    pub authenticator_data: Bytes,

    /// This is the DER [SubjectPublicKeyInfo] of the new credential. Or None if it is not available.
    ///
    /// [SubjectPublicKeyInfo]: https://datatracker.ietf.org/doc/html/rfc5280#section-4.1.2.7
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_key: Option<Bytes>,

    /// This is the [CoseAlgorithmIdentifier] of the new credential
    ///
    /// [CoseAlgorithmIdentifier]: https://w3c.github.io/webauthn/#typedefdef-cosealgorithmidentifier
    #[typeshare(serialized_as = "I54")] // because i64 fails for js
    pub public_key_algorithm: i64,

    /// This attribute contains an attestation object, which is opaque to, and cryptographically
    /// protected against tampering by, the client. The attestation object contains both
    /// [`AuthenticatorData`] and an attestation statement. The former contains the [`Aaguid`], a unique
    /// credential ID, and the [`AttestedCredentialData`] of the credential's public key. The contents
    /// of the attestation statement are determined by the attestation statement format used by the
    /// authenticator. It also contains any additional information that the Relying Party's server
    /// requires to validate the attestation statement, as well as to decode and validate the
    /// [`AuthenticatorData`] along with the JSON-compatible serialization of client data.
    pub attestation_object: Bytes,

    /// This field contains a sequence of zero or more unique [`AuthenticatorTransport`] values in
    /// lexicographical order. These values are the transports that the authenticator is believed to
    /// support, or an empty sequence if the information is unavailable. The values SHOULD be
    /// members of [`AuthenticatorTransport`] but Relying Parties SHOULD accept and store unknown values.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transports: Option<Vec<AuthenticatorTransport>>,
}
```

#### [`Authenticator Data`](https://www.w3.org/TR/webauthn-3/#table-authData)


| Name                   | Length (in bytes)         | Description                                                                                                                                                                                                                                                                                                                                                                  |
|------------------------|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| rpIdHash               | 32                        | SHA-256 hash of the RP ID the credential is scoped to.                                                                                                                                                                                                                                                                                                                       |
| flags                  | 1                         | Flags (bit 0 is the least significant bit):<br>• Bit 0: User Present (UP) result.<br>  ◦ 1 means the user is present.<br>  ◦ 0 means the user is not present.<br>• Bit 1: Reserved for future use (RFU1).<br>• Bit 2: User Verified (UV) result.<br>  ◦ 1 means the user is verified.<br>  ◦ 0 means the user is not verified.<br>• Bit 3: Backup Eligibility (BE).<br>  ◦ 1 means the public key credential source is backup-eligible.<br>  ◦ 0 means the public key credential source is not backup-eligible.<br>• Bit 4: Backup State (BS).<br>  ◦ 1 means the public key credential source is currently backed up.<br>  ◦ 0 means the public key credential source is not currently backed up.<br>• Bit 5: Reserved for future use (RFU2).<br>• Bit 6: Attested credential data included (AT).<br>  ◦ Indicates whether the authenticator added attested credential data.<br>• Bit 7: Extension data included (ED).<br>  ◦ Indicates if the authenticator data has extensions. |
| signCount              | 4                         | Signature counter, 32-bit unsigned big-endian integer.                                                                                                                                                                                                                                                                                                                       |
| attestedCredentialData | variable (if present)     | attested credential data (if present). See § 6.5.2 Attested Credential Data for details. Its length depends on the length of the credential ID and credential public key being attested.                                                                                                                                                                                      |
| extensions             | variable (if present)     | Extension-defined authenticator data. This is a CBOR [RFC8949] map with extension identifiers as keys, and authenticator extension outputs as values. See § 9 WebAuthn Extensions for details.                                                                                                                                                                               |


The `authenticatorData` in an attestation response (`AuthenticatorAttestationResponse`) contains `flags` that provide information on the **backup eligibility** and **backup state** of the WebAuthn credential. If the wallet deems that backup should be required for a WebAuthn credential, the wallet should check the Backup Eligibility (`BE`)and Backup State (`BS`) flags in the `AuthenticatorAttestationResponse` to ensure that the credential is backed up. Having both `BE` and `BS` set to true implies that the [credential is a multi-device credential and is currently backed up](https://www.w3.org/TR/webauthn-3/#sctn-credential-backup).

For those looking to use passkeys as a recoverable private key alternative for Aptos accounts, it is highly advised that the `BE` and `BS` flags both be set to `true` **BEFORE** the on-chain account is created to ensure that the account is recoverable in the event of device loss.

#### Parsing the Public Key

[`AttestedCredentialData`](https://w3c.github.io/webauthn/#attested-credential-data) contains the `key`, which is the public key associated with the WebAuthn credential.

```rust [code reference](https://github.com/1Password/passkey-rs/blob/c23ec42da5d3a9399b358c5d38f4f5b02f48b792/passkey-types/src/ctap2/attestation_fmt.rs#L206C1-L225C2)
pub struct AttestedCredentialData {
    /// The AAGUID of the authenticator.
    pub aaguid: Aaguid,

    /// The credential ID whose length is prepended to the byte array. This is not public as it
    /// should not be modifiable to be longer than a u16.
    credential_id: Vec<u8>,

    /// The credential public key encoded in COSE_Key format, as defined in Section 7 of [RFC9052],
    /// using the CTAP2 canonical CBOR encoding form. The COSE_Key-encoded credential public key
    /// MUST contain the "alg" parameter and MUST NOT contain any other OPTIONAL parameters.
    /// The "alg" parameter MUST contain a [coset::iana::Algorithm] value. The encoded credential
    /// public key MUST also contain any additional REQUIRED parameters stipulated by the relevant
    /// key type specification, i.e. REQUIRED for the key type "kty" and algorithm "alg"
    /// (see Section 2 of [RFC9053]).
    ///
    /// [RFC9052]: https://www.rfc-editor.org/rfc/rfc9052
    /// [RFC9053]: https://www.rfc-editor.org/rfc/rfc9053
    pub key: CoseKey,
}
```

The credential public key is stored in the [CBOR Object Signing and Encryption format (COSE)](https://datatracker.ietf.org/doc/html/rfc8152) format. The `CoseKey` includes the `x` and `y` coordinates of the public key, which when combined, produces the public key. 

With the raw public key, an Aptos account address can be derived. Note that the default authentication key derivation will vary depending on the account type created (`SingleKey` or `MultiKey`).

### Signing a transaction

In a traditional client-server implementation of the WebAuthn specification, both registering a new credential and authentication assertion use [challenge-response authentication](https://en.wikipedia.org/wiki/Challenge%E2%80%93response_authentication) to avoid several types of attacks. Randomized challenges are particularly important for protecting against [replay attacks](https://en.wikipedia.org/wiki/Replay_attack) [(§13.4.3)](https://www.w3.org/TR/webauthn-3/#sctn-cryptographic-challenges).

Aptos is adapting the WebAuthn specification to be used for on-chain accounts and transactions. As many already know, on-chain transactions include a sequence number to avoid replay attacks on Aptos. Thus, if transactions are used as the challenge in a WebAuthn assertion, the replay attack risk is mitigated even if the challenge is not randomly generated by the wallet.

#### [`challenge`](https://www.w3.org/TR/webauthn-3/#authenticatorassertionresponse)

```js [code reference](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions)
dictionary PublicKeyCredentialRequestOptions {
    required BufferSource                   challenge;
    unsigned long                           timeout;
    USVString                               rpId;
    sequence<PublicKeyCredentialDescriptor> allowCredentials = [];
    DOMString                               userVerification = "preferred";
    sequence<DOMString>                     hints = [];
    DOMString                               attestation = "none";
    sequence<DOMString>                     attestationFormats = [];
    AuthenticationExtensionsClientInputs    extensions;
};
```

During an assertion, the `SHA3-256` digest of `signing_message(raw_transaction)` is provided as the `challenge` in [`PublicKeyCredentialRequestOptions`](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialrequestoptions). The [`signing_message`](https://github.com/aptos-labs/aptos-core/blob/main/crates/aptos-crypto/src/traits.rs#L151) function is applied before computing the `SHA3-256` of the `raw_transaction` to acheive domain separation without further increasing the size of the challenge. 

In other words, the `challenge` is:

$$
challenge = H({signing\\_message(raw\\_transaction)})
$$

where $H$ is a `SHA3-256` hash.

#### [`AuthenticatorAssertionResponse`](https://www.w3.org/TR/webauthn-3/#authenticatorgetassertion)

After the `PublicKeyCredentialRequestOptions` are successfully submitted via `navigator.credentials.get()`, an `AuthenticatorAssertionResponse` is returned to the client, like so:

```js [code block](https://www.w3.org/TR/webauthn-3/#authenticatorassertionresponse)
interface AuthenticatorAssertionResponse : AuthenticatorResponse {
    [SameObject] readonly attribute ArrayBuffer      authenticatorData;
    [SameObject] readonly attribute ArrayBuffer      signature;
    [SameObject] readonly attribute ArrayBuffer?     userHandle;
    [SameObject] readonly attribute ArrayBuffer?     attestationObject;
};
```

#### [`Signature`](https://www.w3.org/TR/webauthn-3/#dom-authenticatorassertionresponse-signature)

The `signature` included in the `AuthenticatorAssertionResponse` is computed over a message `m` where `m` is the binary concatenation of `authenticatorData` and the SHA-256 digest of `clientDataJSON`.[^verifyingAssertion]. `clientDataJSON` is a JSON serialization of [`CollectedClientData`](https://www.w3.org/TR/webauthn-3/#dictdef-collectedclientdata) and includes the `challenge` and other data about the request like the `origin` and the [`type`](https://www.w3.org/TR/webauthn-3/#dom-collectedclientdata-type) of the request.

In other words, for a signature $\sigma$:

$$
\begin{aligned}
m &= \text{authenticatorData} \ || \ H(\text{clientDataJSON})\\
\sigma &= \text{sign}(\text{sk}, m)
\end{aligned}
$$

where $H$ is a `SHA-256` hash (note: NOT `SHA3-256`), $sk$ is the passkey secret key (private key), and $||$ is binary concatenation.

#### [`AuthenticatorAssertionResponse`](https://www.w3.org/TR/webauthn-3/#authenticatorassertionresponse)

```js
interface AuthenticatorAssertionResponse :AuthenticatorResponse {
    [SameObject] readonly attributeArrayBufferauthenticatorData;
    [SameObject] readonly attributeArrayBuffersignature;
    [SameObject] readonly attributeArrayBuffer?userHandle;
};
```

### Transaction Submission

This AIP builds upon the new `TransactionAuthenticator`s and `AccountAuthenticator`s presented in [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md) by using the `SingleKeyAuthenticator` and `MultiKeyAuthenticator`, which supports a single key and a k-of-n multi-key, respectively. A new `WebAuthn` variant under `AnySignature` and a new `Secp256r1Ecdsa` variant under `AnyPublicKey` enables users to submit transactions using a `Secp256r1` WebAuthn credential from both a `SingleKey` or `MultiKey` account.

```rust
AccountAuthenticator::SingleKey { authenticator: SingleKeyAuthenticator }
AccountAuthenticator::MultiKey { authenticator: MultiKeyAuthenticator }

pub struct SingleKeyAuthenticator {
    public_key: AnyPublicKey,
    signature: AnySignature,
}

pub struct MultiKeyAuthenticator {
    public_keys: MultiKey,
    signatures: Vec<AnySignature>,
    signatures_bitmap: aptos_bitvec::BitVec,
}

pub struct MultiKey {
    public_keys: Vec<AnyPublicKey>,
    signatures_required: u8,
}

pub enum AnySignature {
    ...,
    WebAuthn {
        signature: PartialAuthenticatorAssertionResponse,
    },
}

pub enum AnyPublicKey {
    ...,
    Secp256r1Ecdsa {
        public_key: secp256r1_ecdsa::PublicKey,
    },
}
```

Each `signature` in the `WebAuthn` variant for `AnySignature` is structured as a `PartialAuthenticatorAssertionResponse`. The `PartialAuthenticatorAssertionResponse` includes all of the information needed to verify a WebAuthn signature.

```rust
pub enum AssertionSignature {
    Secp256r1Ecdsa {
        signature: secp256r1_ecdsa::Signature,
    },
}

pub struct PartialAuthenticatorAssertionResponse {
    /// This attribute contains the raw signature returned from the authenticator.
    /// NOTE: Many signatures returned from WebAuthn assertions are not raw signatures.
    /// As an example, secp256r1 signatures are encoded as an [ASN.1 DER Ecdsa-Sig_value](https://www.w3.org/TR/webauthn-3/#sctn-signature-attestation-types)
    /// If the signature is encoded, the client is expected to convert the encoded signature
    /// into a raw signature before including it in the transaction
    signature: AssertionSignature,
    /// This attribute contains the authenticator data returned by the passkey W authenticator.
    /// See [`AuthenticatorData`](passkey_types::ctap2::AuthenticatorData).
    authenticator_data: Vec<u8>,
    /// This attribute contains the JSON byte serialization of [`CollectedClientData`](CollectedClientData) passed to the
    /// authenticator by the client in order to generate this credential. The exact JSON serialization
    /// MUST be preserved, as the hash of the serialized client data has been computed over it.
    client_data_json: Vec<u8>,
}
```

### Signature Verification

Once the transaction has reached the signature verification step, the WebAuthn authenticator will then perform the following steps on the signature $\sigma$:

1. Verify that the actual `RawTransaction` matches the expected `challenge` from `clientDataJSON` by computing $H(signing\\_message(raw\\_transaction))$, where $H$ is a `SHA3-256` hash, and verifying that it equals the `challenge` in `clientDataJSON`
2. Reconstruct the message `m` with the `clientDataJSON`, and `authenticatorData`, and
3. Given the message `m`, a public key `pk` and a raw signature $\sigma$, apply a verification function to determine if $V(σ, m, pk)$ evaluates to `true`

Assuming everything else is correct, verification passes, and other validators agree on the result, this transaction will succeed and be added to the blockchain state.

### Transaction Submission Summary

To summarize, in the Aptos blockchain implementation of the WebAuthn specification, the high-level protocol for authentication assertion is as follows: 

1. The client provides a `challenge` in the form of the `SHA3-256` of the `signing_message` of the `RawTransaction`. We use the `SHA3-256` of the `RawTransaction` instead of the `RawTransaction` to limit the size of the `challenge`, which is part of the `clientDataJSON`.
2. If the user provides consent, the user agent (browser) will request the WebAuthn Authenticator to use a Passkey credential to generate an assertion signature over a message `m` where `m` includes the challenge and returns a response to the client. 
3. The client will then send a `SignedTransaction` to the blockchain, where the signature field of the `SignedTransaction` includes the relevant fields in the WebAuthn Authenticator response 
4. The blockchain will verify that the `SignedTransaction`'s signature is over the same message `m` (which includes the `RawTransaction`) and verify that the assertion signature is valid with the corresponding public key

## Reference Implementation

The implementation for the work in this AIP can be found in the [Passkeys Authenticator PR](https://github.com/aptos-labs/aptos-core/pull/10755).

## Testing (Optional)

Testing can be found in the reference implementation provided in the PR link above

## Risks and Drawbacks

> [!WARNING]  
> This AIP does not aim to prescribe or enforce a particular solution to the risks and drawbacks mentioned below. Ultimately, however, it is the responsibility of the wallet provider to address these risks appropriately. 
> 
> One way a wallet may address some of the recoverability risks mentioned below is by allowing a user to set up a k-of-n `MultiKey` account (as per [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md)) associated with their passkey. An additional non-passkey signer enables a user to access their account, even if the wallet is unavailable.For instance, configuring a 1-of-2 `MultiKey` account with a passkey and an `ed25519` private key enables transaction signing even if the wallet is unavailable. However, the wallet will need to provide a way for the user to access the passkey public key even if the wallet is unavailable. This is because the `MultiKey` Authenticator requires all associated public keys in transactions. Refer to the [Loss of Passkey Public Key](#Loss-of-Passkey-Public-Key) section for further information.
>


### Backup State and Eligiblity 

As mentioned in AIP 61:

> **Passkeys are not always backed up to the cloud** on some platforms (e.g., Microsoft Windows). 

For this reason, it is important to check the `backupEligible` and `backupState` flags from the `authenticatorData` in the registration response to ensure that the passkey has been backed up properly.

#### Operating Systems

See the [operating system reference](https://passkeys.dev/docs/reference/) to better understand what operating systems support passkeys and their limitations. Most notably, passkeys registered on Windows devices will NOT be backup-able as of February 2023. If the user would like the passkey to be backed up, it is recommended that they use a device that allows for multi-device credentials and supports passkey backup.

#### Browsers

See this [device support matrix](https://passkeys.dev/device-support/) for more info on which browsers and operating systems enable backup-able passkeys.

#### Incompetent / Malicious Authenticators

If a user's authenticator is backup eligible, in many cases, the passkey will be backed up to their iCloud or Google Password Manager account. In some instances, however, a user may have a custom authenticator, like a password manager (e.g., 1Password), that stores the passkey. 

When registering a passkey with a password manager, the passkey will be backed up to the user's password manager account instead of their iCloud or Google Password Manager account. This is an important consideration for backup eligibility and backup state as the user trusts the password manager and their implementation of the Client to Authenticator Protocol ([CTAP](https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130)) for passkey backup. As mentioned in the [Compromised Cloud Provider](#Compromised-Cloud-Provider) section below, if the password manager is compromised, so is your passkey account.

To mitigate the risk of potentially malicious authenticators, the wallet should parse the Attested Credential Data in the Authenticator Data for the [`AAGUID`](https://www.w3.org/TR/webauthn-2/#sctn-authenticator-model) associated with the credential. 

The [`AAGUID`](https://www.w3.org/TR/webauthn-2/#sctn-authenticator-model) is a 128-bit identifier indicating the type (e.g. make and model) of the authenticator. The [`AAGUID`](https://www.w3.org/TR/webauthn-2/#sctn-authenticator-model) associated with Google Password Manager, iCloud, and several other password managers can be found on the [passkey-authenticator-aaguids](https://github.com/passkeydeveloper/passkey-authenticator-aaguids/blob/main/aaguid.json) repo.


### Wallet Liveness

An important **liveness consideration** is that the wallet that is tied to your passkey must be available in order for users to access their accounts. 

Several supported browsers, like Google Chrome, that implement the Client to Authenticator Protocol ([CTAP](https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130.html)), which regulates the communication protocol between a roaming authenticator and the browser, check to see if the wallet is available before allowing the user to register or make an assertion with the passkey.

In other words, if the wallet is unavailable or returns an error like a 404, the user will not be able to use the passkey associated with that wallet until the wallet comes back online. This includes signing transactions with your passkey.

To learn more about how Chromium handles assertion and registration requests, see [`webauthn_handler.h`](https://github.com/chromium/chromium/blob/95bb60bf7fd3d18f469f050b60663b3dbdfa0402/content/browser/devtools/protocol/webauthn_handler.h#L19)

### Incompetent or Malicious Wallet

#### Loss of Passkey Public Key

- If the wallet loses the public key associated with the passkey, the user will not be able to submit transactions to the blockchain. This is because transactions require a public key for signature verification. There are two primary strategies for mitigating this risk:
  1. **(Recommended)** Ensure the passkey is associated with a k-of-n `MultiKey` account. Store the mapping between a passkey `credentialId`, `publicKey`, and `address` on chain. If the wallet is unavailable, the user can retrieve the public key associated with passkey credential from the blockchain and submit a `MultiKey` transaction, signed by a non-passkey signer.
  2. The passkey public key associated with a `secp256r1` passkey credential can be recovered from an ECDSA signature ([ECDSA public key recovery](https://wiki.hyperledger.org/display/BESU/SECP256R1+Support#SECP256R1Support-PublicKeyRecoveryfromSignature)). This, however, assumes that the passkey provider is available. 
     - Note: Public key recovery is an important consideration for future supported WebAuthn signature schemes as other signature schemes like `ed25519` do not support public key recovery in the same way that ECDSA does.

#### Overwriting the Passkey

If the user creates another credential with the same `userHandle` as an existing credential on that authenticator, it will **OVERWRITE** the existing credential. Wallets must keep track of existing `userHandle`s to ensure this does not happen.

### Compromised Cloud Provider

If your passkey is a multi-device credential, backed up to iCloud or Google Password Manager, and the associated cloud account is compromised, so is your passkey account.

Note this only affects multi-device credentials, not hardware-bound credentials like Yubikeys as those are not backed up.

### Authorization Prompt

A drawback of passkeys is that there is no way to customize the authorization prompt for a WebAuthn Authenticator via the WebAuthn API. Though this may be safer for many payment applications, it might not be ideal for certain applications, such as gaming, where the application may prefer not to require an authorization gesture from the user each time they sign a transaction. Additionally, there is some variability in the authorization message used in the prompt, depending on the WebAuthn Authenticator. Ideally, the authorization prompt might include information about the transaction (e.g., a transaction simulation result) and prompt the user to "Sign the transaction" with their passkey, instead of prompting the user to "Use your <PASSKEY_NAME> passkey for <WALLET_NAME>" or "Use Touch ID to sign in."

Wallets can address this by preemptively educating the user about the passkey transaction signing process. For example, a wallet may change the button for "Sign transaction" to "Authenticate and sign" or "Authenticate and pay," to indicate to the user that authenticating with the passkey will sign the transaction. Additionally, during user onboarding, the wallet may provide educational resources to explain the passkey transaction signing process to the user.

## Future Potential

In general, passkeys provide a seamless and intuitive way for users to generate on-chain accounts and transactions. As passkeys continue to proliferate and grow in popularity, we are excited to see how this approach transforms the way that people think about digital ownership.

## Timeline

### Suggested Deployment Timeline

Passkeys are currently available on Devnet, as of January, 2023.

The suggested timeline for this AIP is release 1.10.

## References

[^verifyingAssertion]: "WebAuthn Level 3 Spec, §7.2 Verifying Assertions, bullet point 23." [W3C](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion).

