## Summary

Currently the commission rate is set by the pool owner at initiation of pool. We propose allowing the pool owner to change the commission rate after delegation pool creation.  

## Motivation

### Goals

This feature will increase flexibility of pool owners over the network / commission rates. Pool owner can adjust operator commission rates as appropriate, based on market conditions and commercial discussions. As such, this will facilitate staking pools to participate in market dynamics. I.e. the pool can be set at a lower commission to attract more stakers or raise commission when needed. Operators can call the function themselves if they are also the pool owner, or if not, work with the pool owner they are operating for

### Non-Goals

Operators will not be able to change commission rate. In our existing design setup, Operators are designated by pool owners.

## Solution

1. The max commission rate is uncapped. Minimum is 0
2. There is a max increase rate of 20% per lockup cycle. This is to safeguard consumers from wild increases in commission rate without them realizing. 
    1. By max increase rate, we mean that the commission rate can +20%. I.e. if the original commission rate is 10%, the new commission rate can go up to 30% in the next cycle.
3. There is no max decrease rate. 
4. The implementation of the new commission rate will not take effect until the next lockup cycle. Multiple change commission calls can be made, but the last change commission call before the end of the lockup cycle will the one that is taken for implementation/

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

As a delegation pool accepts multiple delegators and delegators are provided the same stake-management API as the stake pool owner where `operator_commission_percentage` is taken from rewards generated, any changes to the operator commission rate will impact delegator staking rewards. 

1. We can mitigate risk to delegators by enforcing a max commission cap and/or max change delta
2. Emit an event when update commission function is called that can be tied into front end alerts

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
