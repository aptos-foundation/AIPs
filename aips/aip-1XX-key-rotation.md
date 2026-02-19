---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Supporting Key Rotations For SingleKey And MultiKey Authentication Schemes
author: Oliver He
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Framework)>
created: <04/11/2025>
updated (*optional): <04/11/2025>
requires (*optional): <AIP number(s)>
---

# AIP-1XX - Supporting Key Rotations For SingleKey And MultiKey Authentication Schemes
  
## Summary

This AIP concerns how to extend the the key rotation capabilities to SingleKey and MultiKey authentication schemes.

There are currently two ways to rotate your authentication key.

1. `rotate_authentication_key_call` - this is a private entry function that allows a signer to update the authentication key to any arbitrary 32-bytes.  Here the caller assumes responsibility for providing the function with the appropriate authentication key of the public key they want to use to authenticate with moving forward.

2. `rotate_authentication_key` - this is a public entry function where the caller provides public key to rotate to as an input and provides a proof of ownership of the public key by providing a signature that will be verified by the function via given the public key.  This function only supports Ed25519 and MultiEd25519 authentication schemes. This is due to verification of other authentication schemes are not supported in Move yet.  As a result, MultiKey and SingleKey and its subtypes (Secp256k1, Secp256r1 (Passkeys), Keyless, Federated Keyless) cannot be used with this function.

Though it is possible to rotate your account to use SingleKey or MultiKey via `rotate_authentication_key_call`, one potential issue arises when a user tries to rotate to a MultiKey scheme.  In a MultiKey authentication scheme, a user must have information of all the public keys (even if they do not own the private key) to submit a transaction, as such information is used to verify the authentication key.  Thus, if a user rotates to a K of N MultiKey scheme (assume K < N), even if the user has the private keys of K signers, it is vital that they have knowledge of the N-K public keys of the signers they do not own. If that information is lost, the account is no longer usable.  

To provide a concrete use case that we want to solve for - in Aptos Connect there is a need to add functionality for an addition of a backup key (a traditional Ed25519 signer) to their account (which uses Keyless by default).  This is in order to allow the account to be portable and usable via typical methods of mnemonic import without having to authenticate with the Aptos Connect App via Google or Apple.  This permits account usability even if the dApp or one of the downstream systems keyless relies on is not functional.  Though `rotate_authentication_key_call` can be used to update the public key to be a 1 of 2 signer where you can authenticate with either Keyless or Ed25519 private key, the public key of the Ed25519 private key now becomes sensitive information and knowledge of it is vital or account loss could occur.  Thus such information needs to be persisted somewhere.

This AIP suggests several possible solutions to the the broader problem of how to support rotation to SingleKey and MultiKey in a safe way and to the concrete use case of adding a private key signer to a keyless account for more immediate rollout.  A more detailed exploration of the solutions proposed can be found in the High-level Overview.


### Out of scope

Things that are out of scope is how to index public key information and make that available via API.  This is covered in AIP-1XX.  

## High-level Overview

We will propose two solutions that will be complementary, one to achieve near term goals of being able to add backup key functionality to keyless accounds and one for the longer term of solving being able to support arbitrary key rotations safely as possible.

1. The first solution aimed at solving safe arbitrary key rotations would be to add a new private entry function that is of the signature 

`entry fun rotate_authentication_key_from_public_key(account: &signer, new_public_key_scheme: u8, new_public_key_bytes: vector<u8>)` 

which will derive the authentication key from the public key and rotate the key accordingly.  This avoids potential for account loss due to loss of knowledge of the public key as it is in the entry function payload.  However it does not provide a clean way to recover the public key as you would need to parse it from the entry function payload. Thus we will emit a KeyRotationToPublicKey event defined in AIP-1XX.

The event would be able to be subsequently indexed and be utilized by the account discovery APIs to recover the public key information.  However given that there will be no verification of the public key(s), until the public key is used in signing a transaction, the indexer will mark the public key as `unverified`.  See AIP-1XX for details on why the distinction is important when recovering the public key information.

To address this we will also add a new private entry function

`entry fun rotate_to_multi_key_with_proofs(account: &signer, required_sigs: u8, public_keys: vector<vector<u8>>, proofs: vector<vector<u8>>, proof_bitmap: vector<u8>)`

Which will be used specifically for rotating an account to a multi key with the option to provide proof of ownership of the key.  This will allow for the discovery APIs defined in AIP-1XX to index it properly.  This function requires the ability to verify signatures of all types in Move.  Currently missing is Secp256r1 (Passkeys) and Keyless.  Implementing Move natives which will call the Rust functions to validate such signatures will be required which is non-trivial work.

2. However the need to be able to add backup keys to Keyless accounts is an important usecase that we want to address as soon as possible, as it allows for Keyless accounts to be portable thus enabling full user control over such accounts (and removing the bottleneck on the dApp/Keyless infra).

To do this we will add 2 private entry functions - 

`entry fun add_ed25519_backup_key_on_keyless_account(account: &signer, keyless_public_key: vector<u8>, backup_key: vector<u8>, backup_key_proof: vector<u8>)`

`entry fun replace_ed25519_backup_key_on_keyless_account(account: &signer, keyless_with_backup_multi_key: vector<u8>, new_backup_key: vector<u8>, new_backup_key_proof: vector<u8>)`

Each function would do the following

- Verify the provided keyless_public_key (or the first key of keyless_with_backup_multi_key) defines a keyless public key (wrapped as an AnyPublicKey).
- Verify the keyless_public_key/keyless_with_backup_multi_key matches the authentication key on the account.  This proves that it is the current public key.
- Verify the keyless_public_key (or the first key of keyless_with_backup_multi_key) is the original public key for the account. This public key is verified by default for the account and ensures that the account is accessible. Thus these functions can only be used if the original keyless public key is the sole signer or the first signer of the 1 of 2 multikey.
- Verify the proof for the backup key to add or replace.
- Derive the new authentication key for the 1 of 2 MultiKey of [keyless_public_key, backup_key]
- Emit an event recording the rotation and marking both keys as verified. This is valid to do as the backup key was verified via challenge and the keyless public key is the original key for the account.

The domain for these functions are intentionally limited to Keyless accounts and the backup key must be ed25519.  This is to ensure that there will be minimal maintenance required as there will be no need to support other schemes.  Since there are The checks that the original keyless public must be part of the new public key are there to prevent user error.

Eventually these functions will be able to be deprecated with `rotate_to_multi_key_with_proofs` once available.

## Impact

Any users/developers who want to be able to able to safely utilize key rotation, especially with MultiKey.  This would primarily mean any wallets and dApps who utilize their own Keyless wallet via the SDK.

If no solution is provided than key rotation to MultiKeys will remain an unsafe operation via the `rotate_authentication_key_call` function which has no guard rails.

This work is dependent on AIP-1XX.

## Alternative Solutions

There are other ways to address the issue of public key management when using MultiKeys.

1. After a successful `rotate_authentication_key_call`, submit a follow up a transaction which is a no-op operation and the public key information will be saved on chain when the transaction is committed.  The public key can then be recovered by looking up the latest transaction submitted by the account.

However this means that the follow up transaction is critical and if for example due to network connectivity issues key rotation succeeds but the follow up transaction fails to commit, then the account is at risk.

2. Before attempting to rotate the key, the dApp should persist the public key of the backup key on it's servers.  Then the dApp will be able to look up its own record of the backup key's public key.  This can be used in conjunction with 1. to mitigate it's risk.  

However this requires additional work and infrastructure on each dApp developer who wants to provide such functionality to their Keyless accounts.  It is subject to bugs and failures specific to the chosen implementation.

Neither such solutions provides a comprehensive, standardized and safe way to rotate to MultiKeys.

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

1. Add Move modules to represent Secp256r1, Keyless and Federated Keyless public keys and wrapper structs AnyPublicKey and MultiKey.

2. Introduce the entry functions to add a backup key on keyless accounts.
`entry fun add_ed25519_backup_key_on_keyless_account(account: &signer, keyless_public_key: vector<u8>, backup_key: vector<u8>, backup_key_proof: vector<u8>)`
It will
    - Verify the provided keyless_public_key is a well defined AnyPublicKey of Keyless variant.
    - Verify that the derived auth key from keyless_public_key matches the account.
    - Verify backup_key_proof with the backup_key by calling `assert_valid_rotation_proof_signature_and_get_auth_key`
    - Construct a 1 of 2 MultiKey from keyless_public_key and backup_key
    - Call `rotate_authentication_key_call` with the auth key of the MultiKey in the previous step
    - Emit an event KeyRotationToPublicKey recording the change.

3. Add the entry function
`entry fun rotate_authentication_key_from_public_key(account: &signer, new_public_key_scheme: u8, new_public_key_bytes: vector<u8>)`
It will
    - Deserialize the public key to ensure it is well formed based on the scheme.
    - Derive the authentication key from the public key and scheme.
    - Rotate the authentication key by calling `rotate_authentication_key_call`
    - Emit an event KeyRotationToPublicKey recording the change.

4. Add representation for  Secp256r1, Keyless and Federated Keyless signatures and wrapper structs AnySignature and MultiSignature.

5. Add Move natives to verify signatures

6. Add entry function `entry fun rotate_to_multi_key_with_proofs(account: &signer, required_sigs: u8, public_keys: vector<vector<u8>>, proofs: vector<vector<u8>>, proof_bitmap: vector<u8>)`
It will
    - Parse the public keys and signatures (proofs)
    - Verify the proof_bitmap is well defined
        - All bits are within the range of public_keys.length()
        - The number of bits set is equal to proofs.length()
    - Verify the signatures with the corresponding public key as defined by the proof_bitmap.
    - Rotate the authentication key derived from public_keys
    - Emit an event KeyRotationToPublicKey recording the change (mark verified public keys)

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.
 > What is the feature flag(s)? If there is no feature flag, how will this be enabled?
...
TODO


## Testing 

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc.) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

TODO

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compatibility?
 > - What is the mitigation plan for each risk or drawback?

TODO
## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

TODO

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > **Optional:** Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable. 

...

### Suggested deployment timeline

 > **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out, but we should

...