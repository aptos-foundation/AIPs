---
aip: 41
title: Move module for randomness generation
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/185
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 06/27/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-41 - Move module for randomness generation

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. Discuss the business impact and business value this change would impact.

This AIP proposes a new Move module for smart contracts to **easily** and **safely** generate publicly-verifiable randomness, as opposed to importing it from off-chain beacons like `drand` or oracles like Chainlink.

Importantly, this generated randomness should be unbiasable and unpredictable, even by a malicious minority of the validators (as weighed by stake).

The proposed module should be part of the standard Aptos Move framework.

## Motivation

> Describe the impetus for this change. What does it accomplish? What might occur if we do not accept this proposal?

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?

## Rationale

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

We are proposing a new Move module for generating publicly-verifiable randomness in Move smart contracts.

This module should have a very simple interface, e.g.,:

```
module aptos_std::random {

    /// An object that stores randomness and can be "consumed" to generate a randomn number, a random choice,
    /// a random permutation, etc.
    /// This object cannot be implicitly cloned, but can be converted (or "amplified") into two or more other
    /// `Randomness` objects via `randomness_amplify`.
    struct Randomness { /* ... */ };

    /// Generates different randomness based on the given seed and the calling contract's address.
    public fun generate<T>(seed: &T): Randomness { /* ... */ }

    /// Amplifies the generated randomness object into multiple objects.
    public fun amplify(r: Randomness, n: u64): vector<Randomness> { /* ... */ }

    /// Consumes a `Randomness` object so as to securely generate a random integer $n \in [min_incl, max_excl)$
    public fun number(r: Randomness, min_incl: u64, max_excl: u64): u64 { /* ... */ }

    /// Consumes a `Randomness` object so as to securely pick a random element from a vector.
    public fun pick<T>(r: Randomness, vec: &vector<T>): &T { /* ... */ }

    //
    // More functions can be added here to support other randomness generations operations
    // (e.g., `public fun random_bytes(r: Randomness, size: u64): vector<u8>`)
    //
}
```

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. IDeally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

## Risks and Drawbacks

 > Express here the potential negative ramifications of taking on this proposal. What are the hazards?

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

1. This proposal could give rise to chance-based games (e.g., lotteries, turn-based strategy games, etc.)
2. This proposal could provide a trustworthy randomness beacon for external entities

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

This AIP is strictly about the proposed API, and not its implementation.
  
### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable.

I am not sure if it is applicable.

It may be worth investigating if randomness calls (and their outputs) need to be indexed (e.g., should events be emitted?).

### Suggested deployment timeline

> When should community expect to see this deployed on devnet?
> 
> On testnet?
> 
> On mainnet?

This AIP is strictly about the proposed API, and not its implementation nor deployment.

## Security Considerations

> Has this change being audited by any auditing firm?

No.

> Any potential scams? What are the mitigation strategies?
> Any security implications/considerations?

When instantiating this distributed randomness API with a secret-based approach (e.g., a threshold verifiable random function, or t-VRF) rather than a delayed-based approach (e.g., a verifiable delay function, or VDF), a majority of the stake can collude to predict the randomness ahead of time and/or bias it.

To mitigate against this, contracts can (carefully) incorporate external randomness (e.g., `drand`).

> Any security design docs or auditing materials that can be shared?

No. It is up to the community to refine this API to make it easier & safer to use.

## Testing (optional)

> What is the testing plan? How is this being tested?

This AIP is strictly about the proposed API, and not its implementation. 

Therefore, the testing plan is to gather feedback from Move developers and the wider ecosystem on whether this API is "right," via the AIP process.
