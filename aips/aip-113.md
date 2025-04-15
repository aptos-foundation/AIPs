---
aip: 113
title: Derivable Account Abstraction
author: igor-aptos, lightmark
Status: Draft
type: Framework
created: 02/14/2024
---

# AIP-113 - Derivable Account Abstraction

## Summary

This AIP proposes a new kind of account abstraction (AA) scheme, called Derivable Account Abstraction (DAA), that allows one to derive the address of an AA account given (1) an “abstract public key” (e.g., a public key) and (2) an “authentication function” (e.g., RSA digital signature verification).
In contrast, vanilla AA scheme from AIP-104: (1) must be explicitly enabled for an address via a separate TXN, (2) the public key must typically be first installed on-chain somewhere, and (3) address of the account cannot be derived based on the authentication information, and needs to be looked up. 

This allows registering secondary authentication schemes (as an alternative to native Ed25519), with identical user experience to it. This also allows providing a more flexible and secure way to manage cross-chain signatures.

### Out of scope

How to properly design an derivable AA authentication function/module is out of scope.

## High-level Overview
In Derivable AA, registering an authentication function defines a collections of accounts being authenticated by it. Here's how it works:

1. The user provides an `abstract_public_key`, which is included in the authentication data (`auth_data`).
2. Based on the `abstract_public_key` and the associated `function_info`, the system derives an account address for authentication.
3. The `function_info` used for authentication must be registered in a global whitelist.
4. If the authentication function doesn't abort, the system authenticates the account and authorizes the transaction. Authentication function needs to verify two things:
  - that `auth_data.derivable_abstract_signature()` is a valid signature of `auth_data.digest()` (just like regular AA)
  - that `auth_data.derivable_abstract_public_key()` is correct identity representing the authenticator
    (missing this step would allow impersonation)

This domain-scoped approach allows for registering different authentication schemes, as an alternative to Ed25519, enabling more advanced use cases such as cross-chain integration or different authentication schemes.

Currently, registering a new derivable authentication function is made to require governance proposal, to make sure more scrutiny is placed on those, as they generate an alternative to native Ed25519. Whether to require governance long term or not, is something to be figured out.

### Why is this approach superior to other options?

- **Enhanced Flexibility**: By decoupling authentication from specific account addresses, Derivable AA enables domain-specific authentication logic, making it possible to implement complex workflows.
- **Cross-chain Compatibility**: This method enables seamless cross-chain signature integration, where external accounts can authenticate on Aptos by deriving the correct address from their `abstract_public_key` and `function_info`.
- **Scalability**: Derivable AA is designed to scale, allowing multiple authentication schemes across different use cases without requiring per-account configuration.
 
## Impact

Derivable AA introduces the following features:

- **Cross-Chain Authentication**: The ability to authenticate external accounts from other chains through a domain-specific authentication function, where each domain is associated with a unique signing method.
- **Multi-Domain Flexibility**: Allows multiple authentication schemes to coexist within different domains, enabling a more granular control over permissions and access rights.

## Specification and Implementation Details

### Derivable Dispatchable Authenticator

The `DerivableDispatchableAuthenticator` is a resource that manages authentication functions for a specific domain. This resource at `@0x1` holds a whitelist of authentication functions that can be used by accounts within the domain.

```rust
    /// The dispatchable derivable-scoped authenticator, that defines how to authenticate
    enum DerivableDispatchableAuthenticator has key {
        V1 { auth_functions: BigOrderedMap<FunctionInfo, DerivableRegisterValue> }
    }
```

### Account Address Derivation
The sender account address of Derivable AA is derived based on the `abstract_public_key` and the `function_info`.
```rust
    /// Return the account address corresponding to the given `abstract_public_key`,
    /// for the derivable account abstraction defined by the given function.
    public fun derive_account_address(derivable_func_info: FunctionInfo, abstract_public_key: &vector<u8>): address {
        // using bcs serialized structs here - this allows for no need for separators.
        // Alternative would've been to create unique string, we would need to convert derivable_func_info into string,
        // then authentication_key to hex, and then we need separators as well - like ::
        let bytes = bcs::to_bytes(&derivable_func_info);
        bytes.append(bcs::to_bytes(abstract_public_key));
        bytes.push_back(DERIVABLE_ABSTRACTION_DERIVED_SCHEME);
        from_bcs::to_address(hash::sha3_256(bytes))
    }
```

### Authentication Flow
Derivable AA shares the same flow with normal AA in native code but diverge when it comes to move code. When calling `0x1::account_abstraction::authenticate`, if the `auth_data` is using Derivable AA, 
1. The `abstract_public_key` in the `auth_data` is used to derive the account address.
2. The derived address is checked against the domain’s whitelist to verify if the function_info exists in the domain’s registered functions.
3. If the identity matches and the function exists, the account is authenticated by the corresponding function as normal AA.


Code that needs to be implemented (example for plain ed25519):

```rust
    public fun authenticate(account: signer, aa_auth_data: AbstractionAuthData): signer {
        // abort if auth_data is not valid
        // Example verification of ed25519:
        assert!(
            ed25519::signature_verify_strict(
                aa_auth_data.derivable_abstract_signature(),
                aa_auth_data.derivable_abstract_public_key(),
                aa_auth_data.digest(),
            ),
            EINVALID_SIGNATURE,
        );
        account
    }
```

Code in `account_abstraction.move` that verifies the address before calling:

```rust
    fun authenticate(
        account: signer,
        func_info: FunctionInfo,
        signing_data: AbstractionAuthData,
    ): signer acquires DispatchableAuthenticator, DerivableDispatchableAuthenticator {
        let master_signer_addr = signer::address_of(&account);

        if (signing_data.is_derivable()) {
            assert!(features::is_derivable_account_abstraction_enabled(), error::invalid_state(EDERIVABLE_ACCOUNT_ABSTRACTION_NOT_ENABLED));
            assert!(master_signer_addr == derive_account_address(func_info, signing_data.derivable_abstract_public_key()), error::invalid_state(EINCONSISTENT_SIGNER_ADDRESS));
            let func_infos = dispatchable_derivable_authenticator_internal();
            assert!(func_infos.contains(&func_info), error::not_found(EFUNCTION_INFO_EXISTENCE));
        } else {
            assert!(features::is_account_abstraction_enabled(), error::invalid_state(EACCOUNT_ABSTRACTION_NOT_ENABLED));
            let func_infos = dispatchable_authenticator_internal(master_signer_addr);
            assert!(func_infos.contains(&func_info), error::not_found(EFUNCTION_INFO_EXISTENCE));
        };

        function_info::load_module_from_function(&func_info);
        let returned_signer = dispatchable_authenticate(account, signing_data, &func_info);
        // Returned signer MUST represent the same account address. Otherwise, it may break the invariant of Aptos blockchain!
        assert!(
            master_signer_addr == signer::address_of(&returned_signer),
            error::invalid_state(EINCONSISTENT_SIGNER_ADDRESS)
        );
        returned_signer
    }
```

## Reference Implementation
https://github.com/aptos-labs/aptos-core/pull/15899

## Testing
The above PR has smoke test for Derivable AA.

## Risks and Drawbacks

- Complexity: Managing authentication functions requires clear governance and can introduce additional complexity for both developers and users.
- Gas Limitations: As with the original AA system, complex authentication functions may hit gas limits, which could restrict certain use cases.
- External Dependence: Relying on external signatures for cross-chain interactions means that vulnerabilities in the external systems could affect the security of the Aptos network.

## Security Considerations
- Cross-chain Signatures: Since this model allows external accounts to authenticate using domain-specific signatures, it is crucial to prevent unauthorized access. Specifically, `abstract_public_key` should be securely handled to ensure that impersonation is not possible. This is mitigated by using the whitelist mechanism and by ensuring that the derived account address corresponds to the correct identity.
- Governance: The governance process for adding and removing authentication functions in the whitelist ensures that only authorized signatures are used. Mismanagement of governance could lead to unauthorized functions being added to the whitelist, posing security risks for users using those unverified functions. 
- There is currently no way to "disconnect" account from original authentication.
- Calling `account::rotate_authentication_key_call` will make the ed25519 key passed there be a secondary authentication method on the account
 
## Future Potential

- There is no way to "disconnect" or "rotate" original authentication. A way to disconnect the account can easily be added, in case of private key being compromised. Rotation of the authentication needs to be thought about, and whether it should be supported at the dAA level, or left to the implementations themselves.

## Timeline

### Suggested implementation timeline
Feb 2025

### Suggested developer platform support timeline
March 2025

### Suggested deployment timeline
March 2025
