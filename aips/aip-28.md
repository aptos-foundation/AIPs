---
aip: 28
title: Partial voting for on chain governance
author: michelle-aptos, xingdingw
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/117
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated (*optional): 5/9/2023
---

# AIP 28 - Partial voting for on chain governance

## Summary

With `delegation_pool.move`, end users are able to participate in staking, but the delegation pool owner votes on behalf of the entire pool. Partial voting proposes changes to Aptos Governance by enabling delegators to participate in on chain governance and vote on governance proposals in proportion to their stake amount.

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
6. **When a delegator voter votes, it cannot change its votes once used.**
7. If there are unused votes, OR staker adds stake, OR the pool earns staking rewards, the VOTER **can vote a second time (or third etc.) with new stake/votes**
8. **If change voter, Only take effect NEXT CYCLE**
9. A staker can keep changing voter multiple times during one cycle, but the very last decision will be what is implemented in the next cycle
10. Implication is that now **Staking_contract** will have two changes
    1. Can vote multiple times
    2. Can split the votes within the staking pool towards Yes, No, or just partially un-used

**Alternative solutions:**

Either the operator or the owner of the delegation pool would vote on behalf of the whole pool. This is not ideal as it would give potentially large amounts of voting power to a single individual. 

## Specification

To support partial governance voting, we want the voter account to be managed by delegation_pool module instead of an address selected by the delegation pool owner.
A delegator can attend Aptos governance by calling functions of delegation_pool module, then the module controls the managed voter account to attend Aptos governance.

**Proposed changes**

1. A delegation pool’s voter should be the resource account of its stake pool. Delegation pool already owns the signer capability of this resource account. No extra account needs to be created.
2. Deprecate ```delegation_pool::set_delegated_voter.``` No one can change a delegation pool’s voter after enabling partial governance voting.

### aptos_governance.move

Now a voter can vote on a proposal by calling ```aptos_governance::vote```. However, this function assumes that a stake pool can only vote once with all voting power. To support partial governance voting, aptos_governance module needs to allow a stake pool to vote with partial of its voting power multiple times, as long as the total voting power of these votes does not exceed with the voting power of this stake pool.

**Proposed changes**

1. Add a new function, ```aptos_governance::partial_vote(voter: &signer, stake_pool: address, proposal_id: u64, voting_power: u64,should_pass: bool)```. A voter could vote with partial of its voting power by calling this function.
    - No minimum requirement for voting_power.
    - Field num_votes in VoteEvent might not be the total voting power of stake_pool. There could be some implication on indexer.
    - This function should be able to be called through CLI.
    - This function could be called multiple times. For each call, <voting power of this new vote> + <used voting power of this stake pool on this proposal> <= <current voting power of this stake pool> must be held.
2. Add a struct, ```VotingRecordsV2``` to track voting power usage of each stake pool on each proposal.
    - This struct is only stored in @aptos_framework.
    - The struct contains a Table<RecordKey, u64> where u64 is used voting power.
3. If a stake pool has already voted on a proposal before partial governance voting is enabled, this stake pool cannot vote on this proposal even after partial governance voting is enabled.
    - Used voting power is not tracked before partial governance voting is enabled. Remaining voting power is unknown so this stake pool cannot vote on the proposal again.
4. Existing ```aptos_governance::vote```’s behavior will be slightly different.
    - aptos_governance::vote still votes with all voting power of this stake pool.
    - **Before** partial governance voting is enabled, a stake pool can only call this function once on a proposal with all its voting power at that time. Even if the stake pool has more voting power later(by adding stake or receiving rewards), the stake pool cannot vote with the newly added voting power. 
    - **After** partial governance voting is enabled, a stake pool can still call aptos_governance::vote or aptos_governance::partial_vote no matter if the stake pool has already called aptos_governance::vote or not. The only exception is that the stake pool has already voted on a proposal before partial governance voting is enabled.
    
### delegation_pool.move
    
**Voting power**
    
A delegator’s voting power on a delegation pool is its active+pending_active+pending_inactive. For better permission control, a delegator could delegate their voting power to a voter address. 
    
**Proposed changes**
    
1. Add a struct, ```GovernanceRecords``` to track governance state of a delegation pool. The struct tracks:
    - Each delegtor's delegated voter.
    - Each voter's total voting power.
    - Each voter's used voting power on each proposal.
2. Add a function ```delegation_pool::delegate_voting_power(delegator: &signer, pool_address: address, voter: address)```. 
    - A delegator could delegate its voting power to another address. 
    - Delegators can change their voter at any time but the change won’t take effect until the next lockup period.
    - Lockup period expiration time of last time a delegator changes its voter is recorded. So we can always know its latest voter.
3. Add tables to track voters’ shares in active_shares and inactive_shares pools.
    - The goal is to save gas by avoiding iterating over all delegators.
    - A voter’s shares always equal the sum of all its delegators’ shares.
    - A voter’s total voting power equals the amount of its coin in active_shares and inactive_shares pools.
    
**Vote**
    
A delegator should be able to vote with its own voting power. A delegator cannot change their vote once it’s made.
    
**Proposed changes**
    
1. Add a function, ```delegation_pool::vote(voter: &signer, proposal_id: u64, voting_power: u64,should_pass: bool)```.
    - A voter can vote on a proposal with its partial voting power in case the voter represents a group of users(e.g. CEX/Liquid Staking Service).
    - This function will check the voting power of this voter, then call ```aptos_governance::partial_vote``` with its voter’s signer.
    - This function should be able to be called through CLI.
2. Add a table to track voting power usage of each delegator.
    - The key is <delegator, proposal_id> and the value is the used voting power.
    - This table is stored in the resource account of its stake pool.
    - This table will be created when partial governance voting is enabled on a delegation pool.
3. Add a new event, ```VoteEvent{proposal_id: u64, delegator: address, delegation_pool: address, num_votes: u64, should_pass: bool}``` for delegators’ voting.
    - This event is emitted when a successful vote is made.

**Propose**
    
A delegator should be able to propose if its voting power is more than the minimum proposal threshold in a single delegation pool.
    
**Proposed change**
    
1. Add a new function, ```delegation_pool::create_proposal(proposer: &signer, delegation_pool: address, execution_hash: vector<u8>, metadata_location: vector<u8>, metadata_hash: vector<u8>, is_multi_step_proposal: bool)```.
    - delegation_pool module checks the caller’s voting power. If its voting power meets the minimum proposal threshold, forward this call to aptos_governance::create_proposal_v2.
    - This function should be able to be called through CLI.
2. Add a new event, ```CreateProposalEvent{proposal_id: u64, delegator: address, delegation_pool: address, execution_hash: vector<u8>, proposal_metadata: SimpleMap<String, vector<u8>>}``` for delegators’ proposals.
    - This event is emitted when a successful proposal is created.

**Lockup period**
    
Aptos governance requires that a stake pool can vote on a proposal/make a proposal only if its lockup period ends after the proposal’s expiration time. This brings a problem for delegation pools - all delegators in a delegation pool share the same stake pool so they share the same lockup period.
If a delegation pool’s lockup period ends before a proposal’s expiration time, all the delegators in this delegation pool have to wait to vote on this proposal/make a proposal until the next lockup period starts. 
    
A calculated risk is that delegators will have no time to vote on a proposal if:
1. Their lockup period ends before the proposal’s expiration time.
2. And the proposal’s expiration time and their lockup period end in the same epoch.

**Proposed change**
    
N/A. The current implementation will be kept - no one can reset lockup periods of delegation pools.
    
**Newly created delegation pool**
    
All newly created delegation pools should enable partial governance voting.
    
**Proposed change**
    
Change the default voter in ```delegation_pool::initialize_delegation_pool```.
    
**Existing delegation pools**
    
If a delegation pool is created before enabling partial governance voting, this delegation pool could have a voter selected by the delegation pool. There should be a way to enable partial governance voting for this kind of delegation pool.
    
**Proposed change**
    
Add a new function, ```delegation_pool::enable_partial_governance_voting(stake_pool: address)```.
    - This function will change the voter of stake_pool to its own resource account.
    - This function is permissionless. Any user can call this function.
    - This function should be able to be called through CLI.


## Risks and Drawbacks

Delegators may not always pay attention to new governance proposals that are being proposed on chain or may not want to actively participate in governance. Thus, they can delegate their voting power to another wallet address, such as the operator of the delegation pool.

## Future Potential

1. Partial voting can enable more flexibility for stakers by allowing CEX or liquid staking applications to participate in on chain governance on behalf of their users.
2. Delegators currently cannot change their vote once they have voted, but we may support vote changing in the future.

## Suggested implementation timeline

Targeting end of Q2

## Suggested deployment timeline
   
Beside unit tests in delegation_pool and aptos_governance module, we will be adding e2e tests and deploying the changes in devnet and testnet for extended testing before making a proposal to release in mainnet.
