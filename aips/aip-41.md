---
aip: 41
title: Move APIs for randomness generation
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/185
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 06/27/2023
updated (*optional): <07/28/2023>
requires (*optional): <AIP number(s)>
---

# AIP-41 - Move module for randomness generation

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. 

This AIP proposes a new Move module called `aptos_std::randomness` which enables smart contracts to **easily** and **securely** generate publicly-verifiable randomness.

The proposed `randomness` module leverages an underlying _on-chain cryptographic randomness implementation_ run by the Aptos validators. This implementation, however, is **outside the scope** of this AIP and will be the focus of a different, future AIP. (**TODO:** _Link to said AIP here._)

The only thing this AIP does assume of the _on-chain randomness_ is that it is **unbiasable** and **unpredictable**, even by a malicious minority of the validators (as weighed by stake).

As hinted above, the proposed `randomness` module would be part of the standard Aptos Move framework, under the `aptos_std` namespace.

> Discuss the business impact and business value this change would impact.

We believe that easy-to-use, secure randomness inside Move smart contracts will open up new possibilities for **randomized dapps (randapps)**: dapps whose core functionality requires an unbiasable and unpredictable source of entropy (e.g., games, randomized NFTs airdrops, raffles).

## Motivation

> Describe the impetus for this change. What does it accomplish? 

The impetus for this change is two-fold:

1. Open up the potential for **randomized dapps**, as defined above.
2. Pave the way for **more sophisticated multi-party computation (MPC)** protocols inside Aptos (e.g., timelock encryption)

> What might occur if we do not accept this proposal?

1. **No (secure) randapps**: randomized dapps will either (1) not be easily-enabled on Aptos, hampering ecosystem growth and/or (2) not be securely-enabled, due to the subtleness of importing external randomness on-chain (see discussion in [“Rationale”](#Rationale) below).
2. **Stifled innovation:** Not accepting this proposal could be short-sighted as it would be closing the door to other MPC use cases, which other blockchains support, as hinted above

## Impact

> Which audiences are impacted by this change? What type of action does the audience need to take?

Only **Move developers** are “affected”: they need to learn how to use this new `randomness` module, which is designed to be easy to understand & use.

## Rationale

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

Instead of having a dedicated module for **on-chain randomness**, as part of the Aptos framework, we could provide Move APIs for verifying **external randomness** from off-chain beacons like [`drand`](https://drand.love) or oracles like Chainlink.

In fact, we have already done this! We implemented Move cryptographic APIs that enable verifying `drand` randomness. See this example of a [simple Move lottery](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) that relies on `drand`.

Nonetheless, **relying on an external beacon has several disadvantages**:

1. It is very **easy to misuse** an external randomness beacon
   1. e.g., contract writers could fail to commit to a future `drand` round # whose randomness will be used in the contract and instead accept any randomness for any round #, which creates a fatal biasing attack.
   2. e.g., for external randomness beacons that produce randomness at a fixed interval such as `drand`, clock drift between the beacon and the underlying blockchain forces developers to commit to a far-enough-in-the-future round #. In other words, this adds delay before the underlying dapp can use the randomness.
2. **Randomness is too pricy or produced too slowly **: It is not far fetched to imagine a world where many dapps are actually randapps. In this world, randomness would need to be produced very fast & very cheaply, which is not the case for existing beacons.
3. The external **randomness has to be shipped** to the contract via a TXN, making it more awkward by users to use (e.g., in the [simple Move lottery](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) example above, someone, perhaps the winning user, would have to “close” the lottery by shipping in the `drand` randomness with a TXN).

## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

We are proposing a new `aptos_std::randomness` Move module for generating publicly-verifiable randomness in Move smart contracts.

The module would have a simple interface, e.g.,:

```rust
module aptos_std::randomness {

    /// An object that stores randomness and can be "consumed" to generate a randomn number, a random choice,
    /// a random permutation, etc.
    /// This object cannot be implicitly cloned, but can be converted (or "amplified") into two or more other
    /// `Randomness` objects via `randomness_amplify`.
    struct Randomness { /* ... */ };

    /// Generates different randomness based on the given seed and the calling contract's address. Will return the same `Randomness` object if called with the same seed.
    public fun generate<T>(seed: &T): Randomness { /* ... */ }

    /// Amplifies the generated randomness object into multiple objects.
    public fun amplify(r: Randomness, n: u64): vector<Randomness> { /* ... */ }

    /// Consumes a `Randomness` object so as to securely generate a random integer $n \in [min_incl, max_excl)$
    public fun number(r: Randomness, min_incl: u64, max_excl: u64): u64 { /* ... */ }

    /// Consumes a `Randomness` object so as to securely pick a random element from a vector.
    public fun pick<T>(r: Randomness, vec: &vector<T>): &T { /* ... */ }
    
    /// Consumes a `Randomness` object so as to securely generate a random permutation of `[0, 1, ..., n-1]`
    public fun permutation<T>(r: Randomness, n: u64): vector<u64> { /* ... */ }

    //
    // More functions can be added here to support other randomness generations operations
    // (e.g., `public fun random_bytes(r: Randomness, size: u64): vector<u8>`)
    //
}
```

### How to use the `randomness` API

Imagine a lottery Move module that picks three random winners, once a certain amount of tickets have been bought. It could do so as follows:

```rust
module lottery::lottery {
    use std::vector;
    use aptos_std::randomness;
   
    struct Lottery has key {
        // A list of which users bought lottery tickets
        tickets: vector<address>
    		
      	// ...
    }

    // Called by anyone to decide the winners
    public entry fun decide_winners() acquires Lottery {
    {
        // Get the `Lottery` resource
        let lottery = borrow_global_mut<Lottery>(@lottery);

      	// Generate some randomness using an empty seed
      	let r = randomness::generate(vector::empty<u8>());
      
        // Randomly shuffle the vector of players [0, 1, ..., n-1]
        let p = randomness::permutation(r, vector::length(&lottery.tickets));
      
        // The 1st winner
      	let w1 = p.pop_back();
				
        // The 2nd winner
      	let w2 = p.pop_back();
				
      	// The 3rd winner
      	let w3 = p.pop_back();
      
        // Send winnings to lottery.tickets[w1], ..., lottery.tickets[w3] 

        // ...
    }
      
    // ...
}
```



### Open questions

**O1:** We could eliminate the `seed` argument to `generate` and instead rely on `amplify` to produce multiple `Randomness` objects for different purposes (e.g., pick a random card game and a random player by calling `amplify(generate(), 2)`).

In this case, the API would look like:

```rust
    public fun generate(): Randomness { /* ... */ }
```

This begs the question of what should happen when `generate()` is called twice in the same Aptos transaction? Possibilities are:

 a. Maintain the same behavior: `generate` returns the same randomness across repeated calls in the same TXN.

 b. Abort upon repeated calls: `generate` returns randomness `r` in the 1st call and aborts if ever called again. This prevents developers from misusing `generate` by assuming different calls return different results.

 c. Return different randomness for different calls. This also prevents developers from misusing `generate`. I am not sure if this would make it harder for external applications to track from which `generate` call a piece of randomness was produced.

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

**TODO:** Include link to reference implementation once available.

## Risks and Drawbacks

 > Express here the potential negative ramifications of taking on this proposal. What are the hazards?

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

See [“Motivation”](#Motivation).

In addition, this proposal could provide a trustworthy randomness beacon for external entities

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

**Not applicable**: This AIP is strictly about the proposed API, and not its implementation, which is complex and will be the scope of a different, future AIP.

### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable.

It may be worth investigating whether randomness calls (and their outputs) need to be indexed (e.g., should events be emitted?).

This could be important to make it easier to **publicly-verify** our randomness. Specifically, anyone could look at the `randomness`-related events emitted by a contract to fetch its history of generated randomness and the auxiliary inputs that were used to derive it (e.g., the block #, TXN hash, module name, calling function name, etc.).

### Suggested deployment timeline

> When should community expect to see this deployed on devnet?
> 
> On testnet?
> 
> On mainnet?

See [“Suggested implementation timeline”](#suggested-implementation-timeline): the implementation is complex and will be the scope of a different, future AIP.

## Security Considerations

> Has this change being audited by any auditing firm?

No, and it would be wise for security firms to look over the `randomness` API and reason through how it might be mis-used.

> Any potential scams? What are the mitigation strategies?
> Any security implications/considerations?

When implementing on-chain randomness with a **secrecy-based approach** (e.g., a threshold verifiable random function, or t-VRF) rather than a **delayed-based approach** (e.g., a verifiable delay function, or VDF), a majority of the stake can collude to predict the randomness ahead of time and/or bias it.

While contracts can mitigate against this by (carefully) incorporating external randomness or delay functions, this defeats many of the advantages of on-chain randomness.

> Any security design docs or auditing materials that can be shared?

Not really applicable; this document is self-contained. We leave it up to the community to review this AIP, identify issues in the `randomness` API and propose fixes.

## Testing (optional)

> What is the testing plan? How is this being tested?

See [“Suggested implementation timeline”](#suggested-implementation-timeline): the implementation is complex and will be the scope of a different, future AIP.

Instead, the “testing” plan is to gather feedback from Move developers and the wider ecosystem on whether this API is "right" via AIP discussions.
