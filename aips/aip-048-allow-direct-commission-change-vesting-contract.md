---
aip: 48
title: Allow direct commission change vesting contract
author: wintertoro, movekevin, junkil-park
discussions-to: https://github.com/aptos-foundation/AIPs/issues/237
Status: Accepted
type: Standard Framework
created: 08/23/2023
---

# AIP-48 - Allow direct commission change vesting contract

## Summary

The commission rate cannot be directly changed for a vesting contract after it's been created.
Vesting contract owner can currently get around this by updating the operator and commission rate to a temporary
different operator address, and then change it back in order to only change the commission rate. This can lead to potential validator node downtime.
This proposes allowing the vesting contract owner to change the commission directly while keeping the same operator.

## Motivation

### Goals and Solution

Allow the vesting contract owner to update commission directly while keeping the same operator. This should ensure the
operator is still fairly paid with the previous commission rate for any earned rewards until the moment of change.
Future rewards should use the updated commission rate.

### Impact

Vesting contract owners and corresponding operators.

## Testing

- What is the testing plan?
Automated unit tests and testing in devnet/testnet before releasing to mainnet.

## Risks and Drawbacks

None. The vesting contract owner can technically already do this today via update_operator.

### Backwards compatibility

N/A

### Security Considerations

The framework change in vesting.move will be audited before considered complete.

## Timeline

### Suggested deployment timeline

This change will be part of the v1.7 release.
Testnet: September 2023.
Mainnet: Sep-Oct 2023.

