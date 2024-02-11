---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Passkeys
author: hariria
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedback and reviews>
type: Standard (Core/Framework)
created: <12/14/2023>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Passkey accounts

## Summary

This AIP proposes the first WebAuthn Authenticator for Aptos, enabling users to utilize passkeys and other WebAuthn credentials for on-chain accounts and transaction signing.

[Passkeys](https://fidoalliance.org/passkeys/) are designed to replace passwords as a phishing resistant, faster, and more secure form of user authentication. When a user registers a passkey, a new [public key credential](https://www.w3.org/TR/webauthn-3/#public-key-credential) is created on their device's [authenticator](https://www.w3.org/TR/webauthn-3/#authenticator) - which holds and manages the credentials for that user. As of February 2023, on iOS 16+, Android 9+, and MacOS 13+, the passkey can then securely sync with their device's cloud provider (iCloud or Google Password Manager, for example) using end-to-end encryption to ensure that the passkey is recoverable in the event that the device is lost. When signing in with the passkey, the user is prompted to authenticate - often with a biometric based [authorization gesture](https://www.w3.org/TR/webauthn-3/#authorization-gesture) like Face ID or Touch ID - and provides a response that proves ownership of the passkey via a digital signature.

Passkeys use the [WebAuthn specification](https://www.w3.org/TR/webauthn-3/), a standard co-created by the [FIDO alliance](https://fidoalliance.org/) and the [World Wide Web Consortium (W3C)](https://www.w3.org/), for passkey registration and authentication. We are choosing to use NIST P256 (`secp256r1`) as the first enabled WebAuthn signature scheme because of its broad support across most modern operating systems. Once complete, this will enable users to sign and submit transactions with any compatible WebAuthn credential on Aptos, including multi-device credentials registered on iOS, MacOS, and Android devices, as well as single-device, hardware-bound credentials on devices like Yubikeys.

## Motivation

Blockchains have revolutionized digital asset ownership by providing users with the ability to fully control their account without a centralized custodian. This decentralized model, however, has drawbacks. If the user self-custodies their keys, they are fully responsible for the management of their account and there is no recovery path if users lose their private key.

Passkeys provide a great choice for users to create secure private keys that are recoverable in the event of device loss. Furthermore passkeys make onboarding more seamless by enabling a user to create an account without having to write down a plaintext mnemonic or private key.

## Goals

The objectives of this AIP are twofold:

- To enable users on Aptos to create an on-chain account associated with their WebAuthn credential
- To enable users on Aptos to sign transactions with a WebAuthn credential

## Impact

This AIP will benefit developers and users by providing them with an easy way to create non-phishable, recoverable private keys.

1. **User-friendliness:**
   1. WebAuthn credential registration (private key creation) and transaction signing can be done simply via device biometrics
   2. Enables users to interact with dapps via their Passkey accounts, without having to install a mobile or extension wallet: i.e., a **headless wallet experience**.
   3. By storing the private key securely on the device instead of the browser, passkeys eliminate the need for setting up a wallet password, traditionally required for encrypting private keys in the browser.
   4. On certain operating systems, the passkey is backed up and syncs seamlessly with multiple devices (see [backup eligibility](#backup-eligibility)).

2. **Security:**
   1. With passkeys, the private key is stored securely on the device instead of the browser, alleviating the need to store any sensitive material in browser storage where it could be potentially be accessed by a malicious party either through physical access on the device or supply chain attacks via a malicious dependency.
   2. By default, passkeys provide a consent-driven signing experience and prompt the user to authenticate every time they sign, similar to Apple Pay or Google Pay.
   3. Passkeys are bound to a relying party (e.g., a website) and are not phishable.

## Alternative solutions

See the section on **Alternative Solutions** in [AIP-61](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#alternative-solutions) for a more in-depth exploration into the respective tradeoffs of multi-party computation (MPC), hardware security modules (HSMs), and OpenID blockchain (OIDB) accounts.

### OIDB Accounts

OIDB accounts present a unique and novel way to generate an on-chain account with an OpenID account. This is highly desirable as OIDB accounts are accessible across all devices with browsers. Additionally, most people have an account associated with one or more OIDC providers (e.g., Google) and are familiar with OAuth login flows. Lastly, recoverability is not limited to certain operating systems in the same way that passkeys are.

On the other hand, there are tradeoffs to consider as well:

1. There are centralization and liveness concerns both on the OIDC provider and the services that OIDB accounts require to function in a privacy preserving manner (e.g., pepper service, proving service) respectively.
2. Unless the ephemeral secret key ($\mathsf{esk}$) associated with the OIDB account of the user is encrypted (i.e., with a password) or is a passkey itself, the plaintext ephemeral secret key is still available on the browser, leaving it potentially vulnerable to a malicious actor (but only during its short expiration window). Passkey private keys, on the other hand, are stored on the device when the passkey is backed up, often within a secure element on the device and not on the browser.

## Specification

### Terminology

- [**OIDB account**](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md): An OpenID blockchain (OIDB) account whose security and liveness is backed by an OIDC account (e.g., a Google account) rather than a secret key.
- [**Relying party**](https://www.w3.org/TR/webauthn-3/#relying-party): The website, application, or service that the user is trying to access, which is responsible for verifying a signature from the user's passkey to ensure that the user is who they claim to be. For simplicity, we can say that a "relying party" is synonymous with a **wallet** in this context since both are responsible for managing the user's access to a private key.
- [**WebAuthn Authenticator**](https://www.w3.org/TR/webauthn-3/#authenticator): A cryptographic entity, existing in hardware or software, that can register a user with a given relying party and later assert possession of the registered public key credential, and optionally verify the user to the relying party.


### Aptos Account Creation with Passkeys

During the registration of a new WebAuthn credential, an asymmetric key (i.e., a **private key** and its associateed **public key**) is generated securely on that device. The public key associated with the WebAuthn credential can be used to derive an associated account on chain. The private key, which controls the account, will be secured by the device.

The registration process is particularly important for several reasons:

1. The public key associated with the credential is only revealed during registration. Assertion responses (signing with the passkey) do NOT return the public key. Thus, the registration response must be parsed and the relevant information about the credential should be stored properly and persisted in storage by the relying party.
2. The registration response includes `flags` that describe the backup characteristics of the credential. If passkey backup is an important consideration, these flags should be evaluated **BEFORE** the on-chain account is created.

#### [`PublicKeyCredentialCreationOptions`](https://www.w3.org/TR/webauthn/#dictdef-publickeycredentialcreationoptions)

Every WebAuthn credential is created by the relying party (RP) with a set of options, called `PublicKeyCredentialCreationOptions`. These options help configure many aspects of the WebAuthn credential, including, but not limited to:

- The asymmetric key type for the credential (`Ed25519`, `ECDSA`, `RSA`, etc.)
- User verification requirements during assertions
- Whether the WebAuthn credential should be bound to one device or available cross-platform. 

It's important to carefully consider which options to select as they have significant impacts on the passkey user experience and **CANNOT** be reconfigured after credential creation.

Some fields in `PublicKeyCredentialCreationOptions` have been highlighted below.

**[`PublicKeyCredentialParameters`](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialparameters)**

To make a WebAuthn credential compatible with Aptos, the `pubKeyCredParams` array should only contain supported signature schemes. At the present moment, only `secp256r1` is supported, which requires that the array have one element with `alg: -7` to denote `secp256r1` as the choice of credential type.

**[`PublicKeyCredentialUserEntity`](https://www.w3.org/TR/webauthn-3/#dictdef-publickeycredentialuserentity)**

Each authenticator stores a [credentials map](https://www.w3.org/TR/webauthn-3/#authenticator-credentials-map), a map from ([`rpId`](https://www.w3.org/TR/webauthn-3/#public-key-credential-source-rpid), [[`userHandle`](https://www.w3.org/TR/webauthn-3/#public-key-credential-source-userhandle)]) to public key credential source. For context, a [user handle](https://www.w3.org/TR/webauthn-3/#user-handle) is a unique id for the credential, similar to a `credentialId`, but chosen by the relying party instead of the authenticator. If the user creates another credential with the same `userHandle` as an existing credential on that authenticator (on that user's device / platform), it will **OVERWRITE** the existing credential, thus overwriting the private key associated with a passkey account. To avoid this, it is **IMPERATIVE** for the relying party to maintain a list of previously registered credentials and corresponding user handles.

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


The `authenticatorData` in an attestation response (`AuthenticatorAttestationResponse`) contains `flags` that provide information on the **backup eligibility** and **backup state** of the WebAuthn credential. If the relying party (RP) deems that backup should be required for a WebAuthn credential, the RP should check the Backup Eligibility (`BE`)and Backup State (`BS`) flags in the `AuthenticatorAttestationResponse` to ensure that the credential is backed up. Having both `BE` and `BS` set to true implies that the [credential is a multi-device credential and is currently backed up](https://www.w3.org/TR/webauthn-3/#sctn-credential-backup).

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

Aptos is adapting the WebAuthn specification to be used for on-chain accounts and transactions. As many already know, on-chain transactions include a sequence number to avoid replay attacks on Aptos. Thus, if transactions are used as the challenge in a WebAuthn assertion, the replay attack risk is mitigated even if the challenge is not randomly generated by the relying party.

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
challenge = H(signing\_message(raw\_transaction))
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

The `signature` included in the `AuthenticatorAssertionResponse` is computed over a message `m` where `m` is the binary concatenation of `authenticatorData` and the SHA-256 digest of `clientDataJSON`.[^verifyingAssertion]

In other words, for a signature $\sigma$:

$$
m = authenticatorData \ || \ H(clientDataJSON)\\
\sigma = sign(sk, m)
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

This AIP builds upon the new `TransactionAuthenticator`s and `AccountAuthenticator`s presented in [AIP-55](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-55.md) by using the `SingleKeyAuthenticator` and `MultiKeyAuthenticator` that supports a single key and a k-of-n multi-key, respectively. A new `WebAuthn` variant under `AnySignature` and a new `Secp256r1Ecdsa` variant under `AnyPublicKey` enables users to submit transactions using a `Secp256r1` WebAuthn credential from both a `SingleKey` or `MultiKey` account.

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

1. Verify that the actual `challenge` (`RawTransaction`) matches the expected `challenge` from `clientDataJSON` by computing $H(signing\_message(raw\_transaction))$, where $H$ is a `SHA3-256` hash, and verifying that it equals the `challenge` in `clientDataJSON`
2. Reconstruct the message `m` with the `clientDataJSON`, and `authenticatorData`, and
3. Given the message `m`, a public key `pk` and a raw signature $\sigma$, apply a verification function to determine if $V(σ, m, pk)$ evaluates to `true`

Assuming everything else is correct, verification passes, and other validators agree on the result, this transaction will succeed and be added to the blockchain state.

### Transaction Submission Summary

To summarize, in the Aptos blockchain implementation of the WebAuthn specification, the high-level protocol for authentication assertion is as follows: 

1. The client provides a `challenge` in the form of the `SHA3-256` of the `signing_message` of the `RawTransaction`. We use the `SHA3-256` of the `RawTransaction` instead of the `RawTransaction` to limit the size of the `challenge`, which is part of the `clientDataJSON`.
2. If the user provides consent, the user agent (browser) will request the authenticator to use a Passkey credential to generate an assertion signature over a message `m` where `m` includes the challenge and returns an authenticator response to the client. 
3. The client will then send a `SignedTransaction` to the blockchain, where the signature field of the `SignedTransaction` includes the relevant fields in the authenticator response 
4. The blockchain will verify that the `SignedTransaction`'s signature is over the same message `m` (which includes the `RawTransaction`) and verify that the assertion signature is valid with the corresponding public key

## Reference Implementation

The implementation for the work in this AIP can be found in the [Passkeys Authenticator PR](https://github.com/aptos-labs/aptos-core/pull/10755).

## Testing (Optional)

Testing can be found in the reference implementation provided in the PR link above

## Risks and Drawbacks

### Backup Eligibility 

As mentioned in AIP 61:

> **Passkeys are not always backed up to the cloud** on some platforms (e.g., Microsoft Windows). 

For this reason, it is important to check the `backupEligible` and `backupState` flags from the `authenticatorData` in the registration response to ensure that the passkey has been backed up properly.

#### Operating Systems

See the [operating system reference](https://passkeys.dev/docs/reference/) to better understand what operating systems support passkeys and their limitations. Most notably, passkeys registered on Windows devices will NOT be backup-able as of February 2023. If the user would like the passkey to be backed up, it is recommended that they use a device that allows for multi-device credentials and supports passkey backup.

#### Browsers

See this [device support matrix](https://passkeys.dev/device-support/) for more info on which browsers and operating systems enable backup-able passkeys.

### Wallet Liveness

An important **liveness consideration** is that the relying party (e.g., a wallet) that is tied to your passkey must be available in order for users to access their accounts. 

Several supported browsers, like Google Chrome, that implement the Client to Authenticator Protocol ([CTAP](https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130.html)), which regulates the communication protocol between a roaming authenticator and the browser, check to see if the relying part is available before allowing the user to register or make an assertion with the passkey.

In other words, if the relying party is unavailable or returns an error like a 404, the user will not be able to use the passkey associated with that relying party until the relying party comes back online. This includes signing transactions with your passkey.

To learn more about how chromium handles assertion and registration requests, see [`webauthn_handler.h`](https://github.com/chromium/chromium/blob/95bb60bf7fd3d18f469f050b60663b3dbdfa0402/content/browser/devtools/protocol/webauthn_handler.h#L19)

### Compromised Cloud Provider

If your passkey is a multi-device credential, backed up to iCloud or Google Password Manager, and the associated cloud account is compromised, so is your passkey account.

Note this only affects multi-device credentials, not hardware-bound credentials like Yubikeys as those are not backed up.

### Incompetent or Malicious Relying Party

- If the relying party loses the public key associated with the account, the user will be unable to submit transactions to the blockchain as transactions require a public key for signature verification. That being said, there may be ways to mitigate this via [ECDSA public key recovery](https://cryptobook.nakov.com/digital-signatures/ecdsa-sign-verify-examples#public-key-recovery-from-the-ecdsa-signature).
- If the user creates another credential with the same `userHandle` as an existing credential on that authenticator, it will **OVERWRITE** the existing credential

## Future Potential

In general, passkeys provide a seamless and intuitive way for users to generate on-chain accounts and transactions. As passkeys continue to proliferate and grow in popularity, we are excited to see how this approach transforms the way that people think about digital ownership.

## Timeline

### Suggested Deployment Timeline

Passkeys are currently available on Devnet, as of January, 2023.

The suggested timeline for this AIP is release 1.10.

## References

[^verifyingAssertion]: "WebAuthn Level 3 Spec, §7.2 Verifying Assertions, bullet point 23." [W3C](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion).

