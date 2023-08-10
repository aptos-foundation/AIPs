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

# AIP-41 - Move APIs for randomness generation

**Version:** 1.2

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. 

This AIP proposes a new Move module called `aptos_std::randomness` which enables smart contracts to **easily** and **securely** generate publicly-verifiable randomness.

The proposed `randomness` module leverages an underlying _on-chain cryptographic randomness implementation_ run by the Aptos validators. This implementation, however, is **outside the scope** of this AIP and will be the focus of a different, future AIP. 

**TODO:** _Link to on-chain randomness implementation AIP here._

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
2. **Randomness is too pricy or produced too slowly**: It is not far fetched to imagine a world where many dapps are actually randapps. In this world, randomness would need to be produced very fast & very cheaply, which is not the case for existing beacons.
3. The external **randomness has to be shipped** to the contract via a TXN, making it more awkward by users to use (e.g., in the [simple Move lottery](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) example above, someone, perhaps the winning user, would have to “close” the lottery by shipping in the `drand` randomness with a TXN).

## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

We are proposing a new `aptos_std::randomness` Move module for generating publicly-verifiable randomness in Move smart contracts.

### Rust-like randomness API

The proposed module has a simple & hard-to-misuse interface:

- Any contract can call `randomness::rng()` to create a **random number generator (RNG)**, which will be seeded with unique **entropy** (e.g., 256 uniform, unpredictable bits) from the on-chain randomnes beacon.
- Once created, an RNG can be passed in to helper functions to sample random objects.
  - For example, given an RNG `rng`, a call to `randomness::u64_range(&mut rng, 0, n)` uniformly samples a number in the range `[0, n)`.
  - Or, a call to `randomness::permutation(&mut rng, n)` returns a random shuffle of the vector `[0, 1, 2, ..., n-1]`.
- Importantly, these helper functions **mutate** the RNG, updating its entropy.
- This way the contract may safely sample multiple objects using the same `rng`: 
  - e.g., sample a `u64` via  `randomness::u64_integer(&mut rng)` and then sample a `u256` via `randomness::u256_integer(&mut rng)`.
- **Similarly,** secondary calls to `randomness::rng()`, whether from the same module or from a different module, will also return a mutated RNG seeded with *different* entropy (except with negligble probability due to collisions when sampling 256-bit numbers uniformly).

The `randomness` module follows below:

```rust
module aptos_std::randomness {
    use std::vector;

    /// A _random number generator (RNG)_ object that stores entropy from the on-chain randomness beacon.
    ///
    /// This RNG object can be used to produce one or more random numbers, random permutation, etc.
    struct RandomNumberGenerator has drop { /* ... */ }

    /// Returns a uniquely-seeded RNG.
    ///
    /// Repeated calls to this function will return an RNG with a different seed. This is to
    /// prevent developers from accidentally calling `rng` twice and generating the same randomness.
    ///
    /// Calls to this function **MUST** only be made from private entry functions in modules that have
    /// no other functions. This is to prevent _test-and-abort_ attacks.
    public fun rng(): RandomNumberGenerator { /* ... */ }

    /// Generates a number uniformly at random.
    public fun u64_integer(rng: &mut RandomNumberGenerator): u64 { /* ... */ }
    public fun u256_integer(rng: &mut RandomNumberGenerator): u256 { /* ... */ }

    /// Generates a number $n \in [min_incl, max_excl)$ uniformly at random.
    public fun u64_range(rng: &mut RandomNumberGenerator, _min_incl: u64, _max_excl: u64): u64 { /* ... */ }
    public fun u256_range(rng: &mut RandomNumberGenerator, _min_incl: u256, _max_excl: u256): u256 { /* ... */ }

    /* Similar methods for u8, u16, u32, u64, and u128. */

    /// Generate a permutation of `[0, 1, ..., n-1]` uniformly at random.
    public fun permutation(rng: &mut RandomNumberGenerator, n: u64): vector<u64> { /* ... */ }

    #[test_only]
    /// Test-only function to set the entropy in the RNG to a specific value, which is useful for
    /// testing.
    public fun set_seed(seed: vector<u8>) { /* ... */ }

    //
    // More functions can be added here to support other randomness generations operations
    //
}
```

#### Example: A decentralized lottery

This `lottery` module picks a random winner, once a certain amount of tickets have been bought.

```rust
module lottery::lottery {
    use aptos_framework::account;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::resource_account;
    use aptos_framework::timestamp;

    use aptos_std::randomness;

    use std::error;
    use std::signer;
    use std::vector;

    /// Error code for when a user tries to initate the drawing but no users
    /// bought any tickets.
    const E_NO_TICKETS: u64 = 2;

    /// Error code for when a user tries to initiate the drawing too early
    /// (enough time must've elapsed since the lottery started for users to
    /// have time to register).
    const E_LOTTERY_DRAW_IS_TOO_EARLY: u64 = 3;

    /// The minimum time between when a lottery is 'started' and when it's
    /// closed & the randomized drawing can happen.
    /// Currently set to (10 mins * 60 secs / min) seconds.
    const MINIMUM_LOTTERY_DURATION_SECS : u64 = 10 * 60;

    /// The minimum price of a lottery ticket, in APT.
    const TICKET_PRICE: u64 = 10_000;

    /// The address from which the developers created the resource account.
    /// TODO: This needs to be updated before deploying. See the [resource account flow here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/resource_account.move).
    const DEVELOPER_ADDRESS: address = @0xcafe;

    /// A lottery: a list of users who bought tickets and the time at which
    /// it was started.
    ///
    /// The winning user will be randomly picked from this list.
    struct Lottery has key {
        // A list of users who bought lottery tickets (repeats allowed).
        tickets: vector<address>,

        // Blockchain time when the lottery started. Prevents closing it too "early."
        started_at: u64,
    }

    /// Stores the signer capability for the resource account.
    struct Info has key {
        // Signer capability for the resource account storing the coins that can be won
        signer_cap: account::SignerCapability,
    }

    /// Initializes a so-called "resource" account which will maintain the list
    /// of lottery tickets bought by users.
    ///
    /// WARNING: For the `lottery` module to be secure, it must be deployed at
    /// the same address as the created resource account. See an example flow
    /// [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/resource_account.move).
    public(friend) fun init_module(resource_account: &signer) {
        let signer_cap = resource_account::retrieve_resource_account_cap(
            resource_account, DEVELOPER_ADDRESS
        );

        // Initialize an AptosCoin coin store there, which is where the lottery bounty will be kept
        coin::register<AptosCoin>(resource_account);

        // Store the signer cap for the resource account in the resource account itself
        move_to(
            resource_account,
            Info { signer_cap }
        );
    }

    public fun get_minimum_lottery_duration_in_secs(): u64 { MINIMUM_LOTTERY_DURATION_SECS }

    public fun get_ticket_price(): u64 { TICKET_PRICE }

    /// Allows anyone to (re)start the lottery.
    public entry fun start_lottery() acquires Info {
        let info = borrow_global<Info>(@lottery);
        let resource_account = account::create_signer_with_capability(&info.signer_cap);

        let lottery = Lottery {
            tickets: vector::empty<address>(),
            started_at: timestamp::now_seconds(),
        };

        // Create the Lottery resource, effectively 'starting' the lottery.
        // NOTE: Will fail if a previous lottery has already started & hasn't ended yet.
        move_to(&resource_account, lottery);

        //debug::print(&string::utf8(b"Started a lottery at time: "));
        //debug::print(&lottery.started_at);
    }

    /// Called by any user to purchase a ticket in the lottery.
    public entry fun buy_a_ticket(user: &signer) acquires Lottery {
        let lottery = borrow_global_mut<Lottery>(@lottery);

        // Charge the price of a lottery ticket from the user's balance, and
        // accumulate it into the lottery's bounty.
        coin::transfer<AptosCoin>(user, @lottery, TICKET_PRICE);

        // ...and issue a ticket for that user
        vector::push_back(&mut lottery.tickets, signer::address_of(user))
    }

    /// Allows anyone to close the lottery (if enough time has elapsed & more than
    /// 1 user bought tickets) and to draw a random winner.
    entry fun decide_winners(): address acquires Lottery, Info {
        let lottery = borrow_global_mut<Lottery>(@lottery);

        // Make sure the lottery is not being closed too early...
        assert!(
            timestamp::now_seconds() >= lottery.started_at + MINIMUM_LOTTERY_DURATION_SECS,
            error::invalid_state(E_LOTTERY_DRAW_IS_TOO_EARLY)
        );

        // ...and that more than one person bought tickets.
        if (vector::length(&lottery.tickets) < 2) {
            abort(error::invalid_state(E_NO_TICKETS))
        };

        // Pick a random winner by permuting the vector [0, 1, 2, ..., n-1], and
        // where n = |lottery.tickets|
        let rng = randomness::rng();
        let perm = randomness::permutation(&mut rng, vector::length(&lottery.tickets));
        let winner_idx = *vector::borrow(&perm, 0);
        let winner = *vector::borrow(&lottery.tickets, winner_idx);

        // Pay the winner
        let signer = get_signer();
        let balance = coin::balance<AptosCoin>(signer::address_of(&signer));

        coin::transfer<AptosCoin>(
            &signer,
            winner,
            balance
        );

        winner
    }

    /// Returns a signer for the resource account.
    fun get_signer(): signer acquires Info {
        let info = borrow_global<Info>(@lottery);

        account::create_signer_with_capability(&info.signer_cap)
    }
}
```

Note that the `lottery::decide_winners` function is marked as **private** `entry`. This ensures that calls to it cannot be made from Move scripts nor from any other functions outside the `lottery` module. In other words, `lottery::decide_winners` can only be called as the top-level call in a TXN.

This prevents [test-and-abort attacks](#test-and-abort-attacks), which are discussed below. 

### Test-and-abort attacks

Smart contract platforms are an inherently-adversarial environment to deploy randomness in.

The **key problem** with having a Move function act based on on-chain randomness (e.g., from `randomness::u64_integer`), is that the **effects** of the function call can be **tested for** by calling this function from another module (or from a Move script) and **aborting** if the outcomes are not the desired ones.

#### An example attack

Concretely, if `lottery::decide_winners` were a `public entry` function instead of a **private** entry function:

```rust
public entry fun decide_winners(): address acquires Lottery, Info { /* ... */}
```

Then, a TXN with the following Move script could be used to attack it via **test-and-abort**:

```rust
script {
    use aptos_framework::aptos_coin;
    use aptos_framework::coin;

    use std::signer;

    fun main(attacker: &signer) {
        let attacker_addr = signer::address_of(attacker);

        let old_balance = coin::balance<aptos_coin::AptosCoin>(attacker_addr);

				// For this attack to fail, `decide_winners` needs to be marked as a *private* entry function
        lottery::lottery::decide_winners();

        let new_balance = coin::balance<aptos_coin::AptosCoin>(attacker_addr);

        // The attacker can see if his balance remained the same. If it did, then
        // the attacker knows they did NOT win the lottery and can abort everything.
        if (new_balance == old_balance) {
            abort(1)
        };
    }
}
```

## Open questions

**O1:** Should the `randomness` module be part of `aptos_framework` rather than `aptos_std`?

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

There is a reference **dummy** implementation of the proposed `aptos_std::randomness` API and a **proper** implementation of the `lottery` example [in this PR](https://github.com/aptos-labs/aptos-core/pull/9581), which should be merged soon.

**TODO:** Update with link to `move-examples/` code once merged.

## Risks and Drawbacks

 > Express here the potential negative ramifications of taking on this proposal. What are the hazards?

There is a risk of proposing an **easy-to-misuse** API. 

### Accidentally re-generating the same randomness

It should be impossible to misuse the API to re-sample a previously-sampled piece of randomness (excluding allowed collisions, of course).

An example of this would be if a developer creates two RNG objects:

```
let rng1 = randomness::rng();
let rng2 = randomness::rng();
```

...and uses each one to sample two, say, `u256` integers `n1` and `n2` :

```
let n1 = randomness::u256(&mut rng1);
let n2 = randomness::u256(&mut rng2);
```

What the developer does **NOT** want is for `n1` and `n2` to always end up equal because they were sampled from the same underlying RNG with the same entropy.

This can be avoided by ensuring that the entropy underneath `rng2` will (**likely**) be different than the entropy  on `rng1`.

As a result, developers **cannot make a mistake** and accidentally sample once when they expected to sample twice.

**Why will the entropy only be “likely” different?**: We say “likely” due to the underlying cryptographic implementation of the entropy mutation, which will have a negligible probability (e.g.., $< 1/2^{128}$) of not actually mutating the entropy (e.g., due to collisions in hash functions).

**Note:** As an alternative, the API could also **abort** upon seeing a second `randomness::rng()` call in the same TXN. However, it is unclear if this would prevent use-cases where two `entry` functions call each other yet both make calls to `randomness::rng()`.

Another concern is the **API is not expressive enough**. For example, if there is no support for safely converting the `Randomness` object into a random shuffle (or a uniform integer, or a random choice from a vector, etc.), developers might implement this themselves but do it incorrectly.

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

Not yet, but it will be audited by the time it is deployed. Updates will be posted here.

> Any security design docs or auditing materials that can be shared?

No. Currently, this document is self-contained. We leave it up to the community to review this AIP, identify issues or limitations in the `randomness` API and suggest fixes.

> Any potential scams? What are the mitigation strategies?

Any smart dapp can have malicious bugs introduced on purpose. As a result, it is crucial that users to audit the dapp’s code, or verify that others have done so, before engaging with it.

In this sense, randapps are just as susceptible to maliciously-introduced bugs as normal dapps.

> Any security implications/considerations?

Yes. We discuss them below.

### Security consideration: API implementation 

When implementing on-chain randomness with a **secrecy-based approach** (e.g., a threshold verifiable random function, or t-VRF) rather than a **delayed-based approach** (e.g., a verifiable delay function, or VDF), a majority of the stake can collude to predict the randomness ahead of time and/or bias it.

While contracts can mitigate against this by (carefully) incorporating external randomness or delay functions, this defeats many of the advantages of on-chain randomness.

### Security consideration: linter for `randomness::rng()` calls.

**TODO:** Write

## Testing (optional)

> What is the testing plan? How is this being tested?

See [“Suggested implementation timeline”](#suggested-implementation-timeline): the implementation is complex and will be the scope of a different, future AIP.

Instead, the “testing” plan is to gather feedback from Move developers and the wider ecosystem on whether this API is "right" via AIP discussions.

## Apendix 

For posterity, past versions of this AIP were:

- [v1.0](https://github.com/aptos-foundation/AIPs/blob/4577f34c8df6c52a213223cd62472ea59e3861ef/aips/aip-41.md), which included a more complicated `randomness` API
- [v1.1](https://github.com/aptos-foundation/AIPs/blob/3e40b4e630eb8aa517b617799f8e578f5f937682/aips/aip-41.md), which failed to account for _test-and-abort_ attacks via Move scripts or external modules.
