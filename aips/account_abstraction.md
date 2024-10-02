---
aip: 
title: Account Abstraction
author: lightmark
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 10/01/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Account Abstraction

## Summary

Account Abstraction (AA) on Aptos allows any account to be authenticated through move code in addition to existing 
authentication schemes supported by native code. This AIP will introduce a new authenticator called `Abstraction` that
delegates the authentication verification to AptosVM running move-based authentication logic.

### Out of scope

How to properly design an authentication function/module is out of scope.
The `PayMaster`, aka, online gas payer, is not included in the design of AA on Aptos.

## High-level Overview
The core concept is to enable the move function to authenticate account signers, moving beyond the limitations of native Rust authenticators, which only support a restricted set of cryptographic schemes. To accomplish this, we propose transferring the authentication process from native Rust code to the AptosVM layer for each abstracted account. The solution we propose involves the following steps:

1. Store the `FunctionInfo` of the customized Move authentication function in a new resource at the AA (Abstract Account) address.
2. When the account uses an AbstractionAuthenticator, the Move function stored in step 1 will be executed (leveraging native dynamic dispatch) to perform the authentication check.

### Why is this approach superior to other options?

- No major security concerns: Users who opt for AA are responsible for managing their account’s security.
- Scalable: This approach can easily scale as it decouples authentication from rigid native cryptographic checks and supports multiple authentication functions.
- Audit-proof and safe: The dispatchable function mechanism has already been audited and is widely used in the FA standard, ensuring its security.
- Rich transaction context: The Transaction Context already provides comprehensive information about the current transaction, which can be leveraged for robust authentication.

This solution enhances flexibility and scalability while maintaining a secure and efficient authentication process.

## Impact

Account Abstraction(AA) aims to support dispatchable authentication **at the level of smart contract.**
The account can set up in such a way that the transaction can be authorized with complicated move smart contract instead of native account authenticators provided by Aptos blockchain core, enabling a series of possibilities:

- Multisig v2 account
- Sandbox or temporary account to isolate assets/risks, etc.
- Restricted permissions granted to trusted applications so users don’t need to sign every transaction.
- Delegation of asset management to a different account (semi-custodial model)

## Alternative Solutions

An alternative solution is to leverage the existing `SignerCapability` to allow user to customize the logic to get access
to it. But this solution cannot sign the transaction on behalf of the delegating account, including calling entry functions. Therefore,
it is more like a workaround than a solution to account abstraction.

## Specification and Implementation Details

### Account Abstraction Authenticator

First and foremost, we will introduce a new native Authenticator that represents the authentication scheme specified
by the current transaction is AA.
```rust
pub enum AccountAuthenticator {
    //...
    Abstraction {
        function_info: FunctionInfo,
        signature: Vec<u8>
    }
}
```
where `function_info` indicates the function registered on the `sender` account that will be called as authentication check
and `signature` is a byte array that includes all the necessary information as the input to the function.

If the `AccountAuthenticator` is not `Abstraction`, the `authentication_key` passed to the prologue will be `Some(auth_key)`;
while if it is `Abstraction` then `authentication_key == None`

### Dispatchable Authenticator

At the framework level, we create a new resource, `DispatchableAuthenticator`. If an account has `DispatchableAuthenticator`, 
it allows the account to be authenticated via the functions registered in the internal map.

```rust
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
/// The dispatchable authenticator that defines how to authenticate this account in the specified module.
/// An integral part of Account Abstraction.
struct DispatchableAuthenticator has key, copy, drop {
    auth_functions: SimpleMap<FunctionInfo, bool>
}

fun authenticate(account: signer, func_info: FunctionInfo, signature: vector<u8>): signer acquires DispatchableAuthenticator {
    let func_infos = dispatchable_authenticator_internal(signer::address_of(&account));
    assert!(simple_map::contains_key(func_infos, &func_info), error::not_found(EFUNCTION_INFO_EXISTENCE));
    function_info::load_module_from_function(&func_info);
    dispatchable_authenticate(account, signature, &func_info)
}

/// The native function to dispatch customized move authentication function.
native fun dispatchable_authenticate(account: signer, signature: vector<u8>, function: &FunctionInfo): signer;
```

Any authentication function must have the same interface as the following function:
```rust
/// The native function to dispatch customized move authentication function.
public fun dispatchable_authenticate(account: signer, signature: vector<u8>): signer;
```
The first parameter, `signer`, represents the current account that needs authentication, and the function's return value is also a `signer`. Typically, this function returns the input signer if the authentication check is successful. However, in some cases, a permissioned signer may be returned to control the resources the transaction can access.
`signature` is a byte array provided by the new account authenticator, which serves as proof for the authentication function to verify.
Best Practice: To prevent replay attacks (both cross-chain), the `signature` must depend on both `chain_id` and `transaction_hash`.

### Dispatchable Authentication
In AptosVM, the following rust function `dispatchable_authenticate`, will call the `authenticate` function in the framework with `function_info` and `signature` specified in
the authenticator, who will dynamically call the function specified by `function_info` to perform the authentication check
if the function is registered in the map. The return value is the serialized signer data which will be the input to the
transaction body.

```rust
fn dispatchable_authenticate(
    session: &mut SessionExt,
    gas_meter: &mut impl GasMeter,
    account: AccountAddress,
    function_info: FunctionInfo,
    authenticator: Vec<u8>,
    traversal_context: &mut TraversalContext,
) -> VMResult<Vec<u8>> {
    session
        .execute_function_bypass_visibility(
            &LITE_ACCOUNT_MODULE,
            AUTHENTICATE,
            vec![],
            serialize_values(&vec![
                MoveValue::Signer(account),
                function_info.as_move_value(),
                MoveValue::vector_u8(authenticator),
            ]),
            gas_meter,
            traversal_context,
        )
        .map(|mut return_vals| {
            assert!(
                return_vals.mutable_reference_outputs.is_empty()
                    && return_vals.return_values.len() == 1,
                "Abstraction authentication function must only have 1 return value"
            );
            let (signer_data, signer_layout) = return_vals.return_values.pop().expect("Must exist");
            assert_eq!(
                signer_layout,
                MoveTypeLayout::Signer,
                "Abstraction authentication function returned non-signer."
            );
            signer_data
        })
}
```

### Authentication Flow
The AA authentication flow works as below:
1. Transaction carries the Abstraction Authenticator.
2. Rust authenticator will run and find it is Abstraction Authenticator so native authentication is noop. But `authentication_key` will be set to `None`.
3. When running prologue, if the `authentication_key` is `None`, it will bypass the authentication key check.
4. After the prologue, AptosVM will check each senders' whether their account authenticator is Abstraction Authenticator. If yes, AptosVM will run the move auth function specified in the `function_info` with `signature` and expect a `signer` to be returned. If any sender's auth function aborts, the authentication check for the whole transaction fails. It is noted that this function has a gas limit if the function call runs above the gas limit it will abort immediately.
5. Run the user transaction body as usual with the `signer`s just returned.

## Reference Implementation
https://github.com/aptos-labs/aptos-core/pull/13688/files

The feature flag for this feature is `std::features::ACCOUNT_ABSTRACTION`.

## Testing
The above PR has API e2e test the functionality of Account abstraction with various cases.

## Risks and Drawbacks

- AA is hard to adopt w/o an auth function library. To make it easy for user to use, the framework should provide a bunch of commonly used 
authentication modules/functions for users to use. Otherwise, it is really hard for beginner to implement customized
authentication logic in move.

- The gas limit of the auth function is fixed so AA cannot support complicated move functions.

## Security Considerations

- The first parameter to the auth function is account `signer`. We believe it is not a security concern since if you choose to delegate your account access to this function, you already agree to give all the access to your account to this function.
- If the gas limit of the auth function is higher than necessary, it may become a dos attack vector.

## Future Potential

We might want to find a way to cover the auth function gas in a way that does not have a fixed limit so abstracted auth
function can have more complex logic.


## Timeline

### Suggested implementation timeline

Oct 2024

### Suggested developer platform support timeline

By the end of 2024.

### Suggested deployment timeline

By the end of 2024.