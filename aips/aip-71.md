---
aip: 71
title: Refactor Aptos Framework Events with Module Events
author: lightmark
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/367
Status: In Review
type: Framework
created: 02/22/2024
---

# AIP-71 - Refactor Aptos Framework Events with Module Events

## Summary

This AIP proposes a migration plan for all handle events (event v1) in Aptos Framework to module
events (event v2) and adding new events.

### Goals

- Migrate all existing events to module events with minimal impact on downstream customized indexer as soon as possible.
- Piggyback new useful new module events to the migration change.

## Motivation

[AIP-44](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-44.md) introduced module events and explained the
motivation and the advantages over the old event with `EventHandle`. Given its superiority, it is favorable to migrate
all the events in Aptos Framework to module events. The major benefits are:

- Module Event does not need event handle.
- Module Event supports parallel execution.
- Module event is easier to index.

Also, when migrating, it is a good opportunity to add new useful events in the same framework upgrade.

## Impact

The successful migration will make events easier to use for Aptos Move developers and indexer builders.
Also, for normal users, the module events will be easier for them to understand and use because the current form is more similar to the syntax of Solidity.

## Alternative solutions

The alternative solution is just change all the events to module events directly. This will immediately break all the 
dApps not updated before the changes are available on mainnet.

## Specification

The default migration strategy:
- Create new struct `T2` with `#[event]` for an event type and add an `event::emit<T2>()` call by each `event::emit_event<T1>()`

Migrated Events

| Module | Event v1 Name | Event v2 Name | ABI update |
|:---:|:---:|:---:|:---:|
|account.move|KeyRotationEvent|KeyRotation|+account:address |
|aptos_account.move|DirectCoinTransferConfigUpdatedEvent|DirectCoinTransferConfigUpdated|  + account:address|
|coin.move|DepositEvent|Deposit|+ account:address|
|coin.move|WithdrawEvent|Withdraw|+ account: address|
|object.move|TransferEvent|Transfer| |
|aptos_governance.move|CreateProposalEvent|CreateProposal| |
|aptos_governance.move|VoteEvent|Vote| |
|aptos_governance.move|UpdateConfigEvent|UpdateConfig| |
|block.move|NewBlockEvent|NewBlock| |
|block.move|UpdateEpochIntervalEvent|UpdateEpochInterval| |
|aptos-token-objects/token.move|MutationEvent|Mutation|+ token:address|
|aptos-token-objects/collection.move|MutationEvent|Mutation|+ collection:address|
|aptos-token-objects/collection.move|BurnEvent|Burn| + previous_owner|
|aptos-token-objects/collection.move|MintEvent|Mint|+ collection:address|
|multisig_account.move|AddOwnersEvent|AddOwners|+ account: address|
|multisig_account.move|RemoveOwnersEvent|RemoveOwners|+ account: address|
|multisig_account.move|UpdateSignaturesRequiredEvent|UpdateSignaturesRequired|+ account: address|
|multisig_account.move|CreateTransactionEvent|CreateTransaction|+ account: address|
|multisig_account.move|VoteEvent|Vote|+ account: address|
|multisig_account.move|ExecuteRejectedTransactionEvent|ExecuteRejectedTransaction|+ account: address|
|multisig_account.move|TransactionExecutionSucceededEvent|TransactionExecutionSucceeded|+ account: address|
|multisig_account.move|TransactionExecutionFailedEvent|TransactionExecutionFailed|+ account: address|
|multisig_account.move|MetadataUpdatedEvent|MetadataUpdated|+ account: address|
|reconfiguration.move|NewEpochEvent|NewEpoch| |
|stake.move|RegisterValidatorCandidateEvent|RegisterValidatorCandidate| |
|stake.move|SetOperatorEvent|SetOperator| |
|stake.move|AddStakeEvent|AddStake| |
|stake.move|ReactivateStakeEvent|ReactivateStake| |
|stake.move|RotateConsensusKeyEvent|RotateConsensusKey| |
|stake.move|UpdateNetworkAndFullnodeAddressesEvent|UpdateNetworkAndFullnodeAddresses| |
|stake.move|IncreaseLockupEvent|IncreaseLockup| |
|stake.move|JoinValidatorSetEvent|JoinValidatorSet| |
|stake.move|DistributeRewardsEvent|DistributeRewards| |
|stake.move|UnlockStakeEvent|UnlockStake| |
|stake.move|WithdrawStakeEvent|WithdrawStake| |
|stake.move|LeaveValidatorSetEvent|LeaveValidatorSet| |
|staking_contract.move|UpdateCommissionEvent|UpdateCommission| |
|staking_contract.move|CreateStakingContractEvent|CreateStakingContract| |
|staking_contract.move|UpdateVoterEvent|UpdateVoter| |
|staking_contract.move|ResetLockupEvent|ResetLockup| |
|staking_contract.move|AddStakeEvent|AddStake| |
|staking_contract.move|RequestCommissionEvent|RequestCommission| |
|staking_contract.move|UnlockStakeEvent|UnlockStake| |
|staking_contract.move|SwitchOperatorEvent|SwitchOperator| |
|staking_contract.move|AddDistributionEvent|AddDistribution| |
|staking_contract.move|DistributeEvent|Distribute| |
|staking_contract.move|SwitchOperatorEvent|SwitchOperator| |
|vesting.move|CreateVestingContractEvent|CreateVestingContract| |
|vesting.move|UpdateOperatorEvent|UpdateOperator| |
|vesting.move|UpdateVoterEvent|UpdateVoter| |
|vesting.move|ResetLockupEvent|ResetLockup| |
|vesting.move|SetBeneficiaryEvent|SetBeneficiary| |
|vesting.move|UnlockRewardsEvent|UnlockRewards| |
|vesting.move|VestEvent|Vest| |
|vesting.move|DistributeEvent|Distribute| |
|vesting.move|TerminateEvent|Terminate| |
|vesting.move|AdminWithdrawEvent|AdminWithdraw| |
|voting.move|CreateProposalEvent|CreateProposal| |
|voting.move|RegisterForumEvent|RegisterForum| |
|voting.move|VoteEvent|Vote| |
|voting.move|ResolveProposal| | |
|token_event_store.move|CollectionDescriptionMutateEvent|CollectionDescriptionMutate| |
|token_event_store.move|CollectionUriMutateEvent|CollectionUriMutate| |
|token_event_store.move|CollectionMaxiumMutateEvent|CollectionMaxiumMutate| |
|token_event_store.move|OptInTransferEvent|OptInTransfer| |
|token_event_store.move|UriMutationEvent|UriMutation| |
|token_event_store.move|DefaultPropertyMutateEvent|DefaultPropertyMutate| |
|token_event_store.move|DescriptionMutateEvent|DescriptionMutate| |
|token_event_store.move|RoyaltyMutateEvent|RoyaltyMutate| |
|token_event_store.move|MaxiumMutateEvent|MaximumMutate| |


## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/10532

https://github.com/aptos-labs/aptos-core/pull/11688

## Risks and Drawbacks

During the migration,
- Double emitting both v1 and v2 events would cause 5% - 10% regression on blockchain performance.
- Related transactions that involve framework modules double emitting events would expect a 5%-15% gas increase.

## Future Potential

The migration period will take 3-6 months depending on the progress of the transition to module event streams. After 
that, a new AIP may be necessary to remove all old events.

## Timeline

### Suggested implementation timeline

already done

### Suggested developer platform support timeline

before release 1.11 to mainnet.

### Suggested deployment timeline

End of Q1 to testnet and then to mainnet.

## Security Considerations

See [Risks and Drawbacks](#Risks-and-Drawbacks)

