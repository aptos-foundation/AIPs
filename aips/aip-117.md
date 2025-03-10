---
aip: 117
title: Add signer capability support for object code deployment
author: mshakeg
discussions-to:
Status: Draft
type: Standard (Framework)
created: 02/17/2024
---

# AIP-117 - Add signer capability support for object code deployment

## Summary

When publishing a package under an object, modules cannot access their object signer after initialization, making it impossible to manage funds sent to the object's primary fungible store. This AIP proposes adding AuthRef support to enable modules to securely access their object signer during initialization and store it for later use, similar to how modules published under resource accounts can retrieve and store their SignerCapability.

The solution introduces an AuthRef abstraction that can only be generated during module initialization, maintaining security while enabling proper fund management capabilities for object-published modules.

### Out of scope

- Changes to how packages are published under objects
- Changes to existing package upgrade mechanisms
- Additional permissioned functions for object management
- Changes to modules already published under objects (cannot retroactively gain AuthRef access)

## High-level Overview

The proposal adds AuthRef support to the `object_code_deployment` module, enabling modules published under objects to generate an AuthRef during initialization that can later be used to generate the object's signer. This brings object-based publishing closer to parity with resource account-based publishing, where modules can already retrieve and store their SignerCapability during initialization.

The AuthRef serves as a capability, proving that a module has the right to generate its object's signer. It can only be created during module initialization when the object signer is naturally available, following Move's capability-based security model.

## Impact

This change impacts:
- Developers publishing modules under objects who need programmatic control over their module's resources
- Existing modules published under objects (cannot retroactively gain AuthRef access)
- Future module designs that may choose object-based publishing over resource account-based publishing

Without this change, modules published under objects would remain limited in their ability to manage funds and resources autonomously, potentially forcing developers to use resource accounts instead or implement complex workarounds.

## Alternative Solutions

1. Restricted API Approach:
```move
pub fun transfer<CoinType>(owner: &signer, amount: u64, destination: address);
pub fun tranfer_fa(owner: &signer, fa_type: Object<Metadata>, amount: u64, destination: address);
```
This alternative would provide specific permissioned functions instead of signer access. However, this approach:
- Limits module autonomy by requiring object owner intervention for transfers
- Doesn't support dynamic/programmatic fund management
- Creates inconsistency with resource account capabilities

2. Additional Object Creation:
Create another object during initialization to use its signer. This approach:
- Adds complexity
- Doesn't solve the issue of managing funds sent to the original object
- Creates confusion about which object should receive funds

The AuthRef approach provides the best balance of security and functionality while maintaining consistency with existing patterns.

## Specification and Implementation Details

The implementation adds three key components to the `object_code_deployment` module:

1. AuthRef struct:
```move
/// Authorization reference for an object that has code published to it
struct AuthRef has drop, store {
    object_address: address
}
```

2. Generation function:
```move
public fun generate_auth_ref(publisher: &signer): AuthRef {
    let addr = signer::address_of(publisher);
    assert!(
        exists<ManagingRefs>(addr),
        error::not_found(ENO_MANAGING_REFS)
    );
    AuthRef { object_address: addr }
}
```

3. Signer generation function:
```move
public fun generate_signer_for_auth(auth_ref: &AuthRef): signer acquires ManagingRefs {
    let extend_ref = &borrow_global<ManagingRefs>(auth_ref.object_address).extend_ref;
    object::generate_signer_for_extending(extend_ref)
}
```

Usage pattern:
```move
fun init_module(publisher: &signer) {
    let auth_ref = object_code_deployment::generate_auth_ref(publisher);
    move_to(publisher, GlobalAuthRef { auth_ref });
}

public fun get_signer(): signer acquires GlobalAuthRef {
    let auth_ref = &borrow_global<GlobalAuthRef>(@module_addr).auth_ref;
    object_code_deployment::generate_signer_for_auth(auth_ref)
}
```

## Testing

Testing plan includes:
1. Unit tests in `object_code_deployment.move`:
   - Basic AuthRef generation and signer creation flow
   - Error cases (missing ManagingRefs)
   - Test-only storage struct for AuthRef

2. E2E tests to verify:
   - Package deployment under object
   - AuthRef generation only possible in init_module
   - Object signer accessibility constraints
   - Proper fund management using generated signer

## Risks and Drawbacks

1. Backwards Compatibility:
- Existing modules published under objects cannot retroactively gain AuthRef access
- Mitigation: Document limitation clearly, only affects future deployments

2. Security Considerations:
- Modules have full signer access after storing AuthRef
- Mitigation: AuthRef can only be generated during initialization, following established capability patterns

3. Risk of Misuse:
- Developers might store AuthRef insecurely
- Mitigation: Provide clear documentation and examples of proper storage patterns

## Security Considerations

1. AuthRef Security:
- Can only be generated during module initialization
- Cannot be forged or created after initialization
- Follows Move's capability-based security model

2. Implementation Requirements:
- Proper validation of ManagingRefs existence
- Secure storage of AuthRef in module state
- Clear documentation of security implications

## Future Potential

1. Short term (1 year):
- Increased adoption of object-based publishing
- Development of standard patterns for AuthRef usage
- Better tooling support for object-published modules

2. Long term (5 years):
- Potential expansion of AuthRef capabilities
- Integration with future object-based features
- Standardization of object-based module patterns

## Timeline

The implementation is complete and pending review in https://github.com/aptos-labs/aptos-core/pull/15954

Upon AIP approval:
1. Complete additional e2e testing
2. Update documentation
3. Deploy with next framework release

No SDK, API, or CLI changes required as changes are limited to the framework.
