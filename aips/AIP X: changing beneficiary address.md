## Summary

Right now, the staking rewards of token owners automatically go to the token owner address, while operator commission goes to the operator’s address. We have received multiple requests for the ability to set a different beneficiary address. One example use case is when operators want their commission to go to a cold storage wallet, whilst their operator address is used for day to day operations.

The below features should apply to both staking_contract and delegated_staking contract.

## Motivation

### Goals

We want to allow token owners and operators to set a different beneficiary address for their staking rewards

- operators want to store commissions rewards in a cold wallet. This change would introduce decoupling of wallet key and operator key, so that funds can be sent to an address different than the operator account.
- The funds would remain in a cold wallet while the operator can perform other operations in a hot wallet.

### Non-Goals

- What are we committing to not doing and why are they scoped out?

## Solution

Token owners and Operators can set a different beneficiary address for their staking rewards

Example: Wallet A = Capital. Wallet B = Staking rewards. When withdrawing, user has to specify if they are unstaking from wallet A or Wallet B? 

- **Note that token owner still has to use wallet A (capital) to sign a withdrawal from Wallet B (staking rewards). —> We need to solve this, as otherwise it defeats the purpose of decoupling, which was to reduce the number of times you use wallet A to sign.**
- If Wallet B is not specified, default all the funds will be under wallet A.

### Specification

- Use example code, diagrams, etc to provide implementation details

### Impact

- Who is impacted by this change?
- Does this impact Ecosystem? If yes, select the `Yes` button below.

## Testing

- What is the testing plan?
- When can we expect the results?
- What are the test results and are they what we expected? If not, explain the gap.

## Risks and Drawbacks

- Express here the potential negative ramifications of taking on this proposal. What are the hazards?

### Backwards compatibility

- Any backwards compatibility issues we should be aware of?
- If there are issues, how can we mitigate or resolve them?

### Security Considerations

- Has this change being audited by an auditing firm?
- Are there potential scams?
    - What are the mitigation strategies?
- What are the security implications/considerations?
- Any security design docs or auditing materials we can share?

## Timeline

### Suggested implementation timeline

- Describe how long you expect the implementation effort to take? Split this up into stages or milestones for readability

### Suggested developer platform support timeline

- Describe the plan to have SDK, API, CLI, Indexer support for this feature if applicable.

### Suggested deployment timeline

- When should community expect to see this deployed on devnet?
- On testnet?
- On mainnet?

## Open Questions

-
