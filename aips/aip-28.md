## Summary

With `delegation_pool.move`, end users are able to participate in staking, but the delegation pool owner votes on behalf of the entire pool. Partial voting changes this by enabling delegators to participate in on chain governance and vote on governance proposals in proportion to their stake amount.

## Motivation

Partial voting increases decentralization by enabling more users to participate in governance. Governance is an important part of the blockchain network because any changes to the blockchain parameters, blockchain core code, and Aptos Framework must go through on chain governance voting. 

Previously, the minimum stake requirement and therefore minimum requirement to participate in governance was 1M APT. With the implementation of partial voting, a delegator who stakes a minimum of 10 APT can participate in on chain governance voting. 

## Rationale

**Considerations:**

1. Delegators can only vote if the delegation pool’s lockup cycle ends after the governance voting period (lockup cannot be reset)
2. Any delegator with locked stake can participate in governance and does not have to be part of an active pool
3. All new delegation pools will have the partial voting functionality at creation 
4. On existing delegation pools, any user can submit a transaction to enable partial voting as a one time action
5. Voters of delegation pools will be managed by delegation_pool module. Delegators can delegate their vote to another wallet address. 
6. **when a delegator voter votes, it cannot change its votes once used.**
7. If there are unused votes, OR staker adds stake, OR the pool earns staking rewards, the VOTER **can vote a second time (or third etc.) with new stake/votes**
8. **if change voter, Only take effect NEXT CYCLE**
9. A staker can keep changing voter multiple times during one cycle, but the very last decision will be what is implemented in the next cycle
10. Implication is that now **Staking_contract** will have two changes
    1. Can vote multiple times
    2. Can split the votes within the staking pool towards Yes, No, or just partially un-used

**Alternative solutions:**

Either the operator or the owner of the delegation pool would vote on behalf of the whole pool. This is not ideal as it would give potentially large amounts of voting power to a single individual. 

## Specification



## Reference Implementation

## Risks and Drawbacks

Delegators may not always pay attention to new governance proposals that are being proposed on chain or may not want to actively participate in governance. Thus, they can delegate their voting power to another wallet address, such as the operator of the delegation pool.

## Future Potential

1. Partial voting can enable more flexibility for stakers by allowing liquid staking applications to build functionalities such as a liquid staking governance portal so that the protocol can participate in on chain governance on behalf of their users.
2. Delegators currently cannot change their vote once they have voted, but we may support vote changing in the future.

## Suggested implementation timeline

Targeting end of Q2

## Suggested deployment timeline
