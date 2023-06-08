---
aip:
title: A new Function for Executing Move Scripts inside the move modules
author: @0xAnto
discussions-to (*optional):
Status: Draft
last-call-end-date (*optional):
type: Standard
created: <06/08/2023>
updated (*optional):
requires (*optional):
---

# AIP-X - A new Function for Executing Move Scripts inside the move modules

## Summary

This proposal aims to introduce a new function called `execute_script` within the Move standard modules, enabling the execution of Move scripts from any move modules. By enabling this functionality, developers will have the ability to create more extensible smart contracts.

## Motivation

Currently, Move scripts can only be executed from the external accounts. This means that developers cannot call Move scripts from other move modules with resource accounts. This limits the extensibility of move modules. This proposal seeks to enhance the capabilities of the resource accounts for building advanced applications.

## Impact

This proposal impacts developers who utilize Move modules and Resource Accounts. Developers will be able to call Move scripts from Resource Accounts which can be used for the creation of smart wallets on Aptos.

## Rationale

The proposed solution is to introduce a new standard module `script` with `execute_script` function to execute the move scripts. By implementing this function, developers can utilize it to call any functions of any module without the need to import them beforehand.

## Specification

The `script` module with `execute_script` function will be added in the standard move module to enable developers to invoke it from any module. The `execute_script` function will take three arguments: a `signer` reference to the account calling the function, a `vector<u8>` representing the compiled Move script, and a `vector<vector<u8>>` representing the input parameters for that script.
This will enhance the capabilities of resource accounts.

## Reference Implementation

    ```
    module 0x07::Test {
        use std::signer;
        use std::script;
        use aptos_framework::account::{Self};

        struct ResourceAccount  has key, store {
            signer_cap: account::SignerCapability
        }

        public fun execute(account: &signer, script: vector<u8>, args: vector<vector<u8>>) acquires ResourceAccount {

            assert!(signer::address_of(account) == 0x07, 10001); // Only allow the owner of the module to call this function
            let resource_account = borrow_global<ResourceAccount>(signer::address_of(account));
            let resource_signer = account::create_signer_with_capability(&resource_account.signer_cap);
            let succeeded = script::execute_script(&resource_signer, script, args); // Execute the script
            assert!(!succeeded, 10002);
        }
    }
    ```

In this example, the execute function is defined in a module called Test. The function takes three arguments: a `signer` reference to the account calling the function, a `vector<u8>` representing the compiled Move script, and a `vector<vector<u8>>` representing the input parameters for that script.

The function first checks if the address of the account calling the function is equal to `0x07`, which is the address of the owner of the module. If it is not equal, the function will abort with an error code of `10001`. This means that only the owner of the module can call this function.

If the address check passes, then the function will borrow the global resource of type `ResourceAccount`, create a signer with the capability from the resource account, and call the execute_script function from the `std::script` module to execute the script. The function will return true if the execution is successful.
Then, the function checks whether the execution was successful or not. If it was not successful, the function will abort with an error code of `10002`.

## Risks and Drawbacks

Implementing the `execute_script` function introduces a security-sensitive capability, as it allows the execution of any Move script passed to it. This poses potential security risks, including the execution of malicious code. To mitigate these risks, it is crucial to handle the usage of the `execute_script` function inside a module with appropriate access controls.

## Future Potential

The introduction of the `execute_script` function will empower developers to create more complex and extensible smart contracts, such as smart contract wallets. This proposal sets the foundation for expanding the capabilities of Move modules and opens up possibilities for further advancements in Aptos.
