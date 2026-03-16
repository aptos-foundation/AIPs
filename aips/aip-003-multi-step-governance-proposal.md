---
aip: 3
title: Multi-step Governance Proposal
author: 0xchloe
discussions-to: https://github.com/aptos-foundation/AIPs/issues/3
Status: Accepted
type: Standard (framework)
created: 12/7/2022
---

# AIP-3 - Multi-step Governance Proposal

## Summary

The Aptos on-chain governance is a process by which the Aptos community can govern operations and development of the Aptos blockchain via proposing, voting on, and resolving proposals.

Currently, an on-chain proposal can only contain one script. Because the MoveVM applies changes to the VM at the end of a script, we cannot include changes that are dependent on previous changes in the same script. This means that we oftentimes need multiple scripts to complete an upgrade.

When we have any upgrade that involves multiple scripts, we need to make multiple single-step proposals, have voters vote on each of them, and resolve each of them manually. We would like to simplify this process by supporting multi-step proposals - this will allow multiple scripts within one on-chain proposal and will execute the scripts in order if the proposal passes.

## Motivation

With multi-step proposals, we will be able to create an on-chain proposal that contains multiple steps, have voters vote on it, and execute all scripts in order at once. This will save effort from the community, as well as enforce that the scripts will be executed in order.

## Alternatives Considered

**Alternative Solution I: Keeping the Status Quo**

Currently, proposing an upgrade with multiple scripts using single-step proposals is time-consuming, manual and likely error-prone if only part of the scripts get executed. We think adding support for multi-step proposals is better because it will save time for proposers, voters, resolvers, and ensures that we execute the steps in the right order.

**Alternative Solution II: Making a change to the MoveVM**

Because the MoveVM applies all changes at the end of the script, we cannot include all upgrades within one single script when some changes are dependent on the other ones in the same script.

We could make a VM-level change to apply changes to the VM at the end of each transaction - this would allow executing all upgrades within one single script. However, it will be a much larger change that will take more than multiple months and affects more parts of the system. We think the smart contracts change essentially achieves the same thing, and is simpler than a VM-level change.

## Specification

To support multi-step proposals, we introduce the concept of a chain of scripts. The voter approves / rejects the entire chain of scripts by voting yes / no on the first script of the chain. There is no partial yes / no.

For example, if we have a multi-step proposal that contains `<script_a, script_b, script_c, script_d>`, the user will only vote on the first script `script_a`. By voting yes on `script_a`, they say yes to the entire chain of scripts `<script_a, script_b, script_c, script_d>`.

When a multi-step proposal passes, we will use CLI to resolve the chain of scripts sequentially.


**Chain of Scripts**
![Screen Shot 2022-11-15 at 12 54 08 PM](https://user-images.githubusercontent.com/79347459/202806189-c629c31e-688c-4f05-8437-087f91c6341f.png)
When we produce the execution scripts, we start from the last script (let's say it's the `x`th proposal), hash it, and pass the hash to the `x-1`th proposal. The on-chain proposal will only contain the first script, but the content and order of the entire chain is implicitly hashed in the first script. We will provide CLI toolings for generating the chain of scripts and verifying that all scripts are present and are in the right order.


**Creating and Voting on Multi-Step Proposals**

The flow will mostly stay the same for creating and voting on proposals:

- When creating a proposal, the proposer will only pass in the first script in the `execution_hash` parameter.
- When voting on a proposal, voting yes / no on the first script indicates that the voter approves / rejects the entire chain of execution scripts.


**Resolving Multi-Step Proposals**

In our proposed multi-step proposal design, when resolving a multi-step proposal,
<img width="715" alt="Screen Shot 2022-11-15 at 3 17 24 PM" src="https://user-images.githubusercontent.com/79347459/202806443-58b0bcf4-4ddb-4fb5-bfda-333a605ba5c3.png">
- `aptos_governance::resolve_multi_step_proposal()` returns a signer and replaces the current execution hash with the hash of the next script.
- `voting::resolve()` checks that the hash of the current script is the same as the proposal’s current execution hash, update the `proposal.execution_hash` on-chain with the `next_execution_hash`, and emits an event for the current execution hash.
- `voting::resolve()` marks that the proposal is resolved if the current script is the last script in the chain of scripts.

**Security**

- Smart Contracts Security & Audit

The implementation will go through security audit with a respectable third-party audit firm to ensure the safety and correctness of the code and the operations.

- Validation

We are mostly concerned about two types of validation:

1. validate that all scripts are present;
2. validate that executing them one by one in order works (chain and replay are good).

We will support CLI tooling for the above validations.

- Decentralization & Governance

This proposal changes the mechanism of what the content of a proposal includes (multiple scripts vs. single scripts), and does not change the powers of the on-chain governance. There is no impact on decentralization or governance abilities.


**Tooling**

We will add CLI and governance UI support for creating, voting on, and resolving multi-step proposals.

## Reference Implementation

Proposed Change PR:

[https://github.com/aptos-labs/aptos-core/pull/5445](https://github.com/aptos-labs/aptos-core/pull/5445)

## Risks and Drawbacks

Decentralization - no impact or changes.

Security - the added governance code will go through strict testing and auditing.

Tooling - CLI support only covers Aptos governance but the multi-step mechanism can be reused for general-purpose DAO/governance. In the near future, the Aptos team and community can improve CLI/tooling to be more generic.

## Tentative Implementation Timeline
11/07 - 11/22
- publish draft AIP for community feedback.
- design review and preliminary security review for the multi-step proposal design.

11/22 - 11/30
- formalize AIP
- flesh out draft PR, add unit tests, and get the PR landed.
- deploy Move changes on Devnet.

11/30 - 12/14
- add CLI support.
- operational testing.
- deploy Move changes on Testnet.

12/15 - 12/20
- e2e testing.
- potentially deploy Move changes on Mainnet. 
