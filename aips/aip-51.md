---

aip: 51

title: Changing beneficiaries for operators

author: junkil-park, michelle-aptos, movekevin, wintertoro

discussions-to: https://github.com/aptos-foundation/AIPs/issues/251

Status: In Review

type: Standard Framework

created: 10/3/2023

---


# AIP-51 - Changing beneficiaries for operators

## Summary

Currently, the operator commission goes to the operator's address. We have received multiple requests for the ability to set a different beneficiary address. One example use case is when operators want their commission to go to a cold storage wallet while their operator address is used for day-to-day operations. This feature applies to the staking contract, the delegated staking contract, and the vesting contract.


### Goals

The goal is to allow operators to set a different beneficiary address for their commission rewards. So, the following scenarios should be possible:
- An operator wants to store commission rewards in a cold wallet. This change would introduce the decoupling of the wallet and operator keys so that funds can be sent to an address different from the operator's account.
- The funds would remain in a cold wallet while the operator can perform other operations in a hot wallet.

### Out of Scope

Changing the beneficiaries for token owners (e.g., stakers, delegators) is out of the scope of this AIP.

### Impact

This feature impacts operators and their beneficiaries. If a current or new operator has never set a beneficiary address explicitly, their beneficiary address is the operator address itself by default.

## Specification
* The beneficiary recieves the commission rewards instead of the operator.
* The beneficiary of a current operator is the operator address itself.
* The beneficiary of a new operator is the operator address itself by default.
* The operator has permission to change its beneficiary address.
* The beneficiary change takes effect immediately.
* The beneficiary can request to withdraw the commission rewards.
* An event is emitted when the beneficiary address is changed.

## Reference Implementation
Please refer to the [reference implementation](https://github.com/aptos-labs/aptos-core/pull/10455).

## Testing
- What is the testing plan?
Automated unit tests and testing in devnet/testnet before releasing to mainnet.

## Risks and Drawbacks
When the operator address is set to a new address, if the beneficiary address remains in the old one, the commission rewards can go to the wrong beneficiary address. To mitigate this, when the pool owner sets a new operator, the beneficiary of the operator will be set to the operator address by default.

Suppose an operator sets the beneficiary to their separate account for rewards and delegates the operator account and the operation to a third party (e.g., contractor). In that case, there is a risk that the third party can change the beneficiary address to their address. No mitigation for this risk is part of this AIP because it is not a common case and is out of scope. A sophisticated access control mechanism is required to mitigate this risk.

## Timeline

### Suggested deployment timeline

This change will be part of the v1.8 release.

### Security Considerations

The framework change in delegation_pool.move will be audited before it is considered complete.
