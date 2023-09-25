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

In fact, we have already done this: see this example of a [simple Move lottery](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) that relies on the `drand` randomness beacon.

Nonetheless, **relying on an external beacon has several disadvantages**:

1. It is very **easy to misuse** an external randomness beacon
   1. e.g., contract writers could fail to commit to a future `drand` round # whose randomness will be used in the contract and instead accept any randomness for any round #, which creates a fatal biasing attack.
   2. e.g., for external randomness beacons that produce randomness at a fixed interval such as `drand`, clock drift between the beacon and the underlying blockchain forces developers to commit to a far-enough-in-the-future round #. In other words, this adds delay before the underlying dapp can use the randomness.
2. **Randomness is too pricy or produced too slowly**: It is not far fetched to imagine a world where many dapps are actually randapps. In this world, randomness would need to be produced very fast & very cheaply, which is not the case for existing beacons.
3. The external **randomness has to be shipped** to the contract via a TXN, making it more awkward by users to use (e.g., in the [simple Move lottery](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) example above, someone, perhaps the winning user, would have to “close” the lottery by shipping in the `drand` randomness with a TXN).

## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

We are proposing a new `aptos_std::randomness` Move module for generating publicly-verifiable randomness in Move smart contracts.

### `randomness` API

The proposed module has a simple yet hard-to-misuse interface:

The module offers a suite functions for randomly-sampling a wide-variety of objects (integers, bytes, shuffles, etc). For example:

- `randomness::u64_integer()` uniformly samples a 64-bit unsigned integer
- `randomness::bytes(n)` uniformly samples a vector of `n` bytes.
- `randomness::permutation(n)` returns a random shuffle of the vector `[0, 1, 2, ..., n-1]`.

Contracts can safely sample multiple objects via repeated calls to these functions. For example, the code below samples two `u64`'s and one `u256`:

```rust
let n1 = randomness::u64_integer();
let n2 = randomness::u64_integer();
let n3 = randomness::u256_integer();
```

The full `randomness` module follows below:

```rust
module aptos_std::randomness {
    use std::vector;
  
    /// Generates `n` bytes uniformly at random.
    public fun bytes(n: u64): vector<u8> { /* ... */ }

    /// Generates a number uniformly at random.
    public fun u64_integer(): u64 { /* ... */ }
    public fun u256_integer(): u256 { /* ... */ }

    /// Generates a number $n \in [min_incl, max_excl)$ uniformly at random.
    public fun u64_range(min_incl: u64, max_excl: u64): u64 { /* ... */ }
    public fun u256_range(min_incl: u256, max_excl: u256): u256 { /* ... */ }

    /* Similar methods for u8, u16, u32, u64, and u128. */

    /// Generate a permutation of `[0, 1, ..., n-1]` uniformly at random.
    public fun permutation(n: u64): vector<u64> { /* ... */ }

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
    struct Credentials has key {
        // Signer capability for the resource account storing the coins that can be won
        signer_cap: account::SignerCapability,
    }

    /// Initializes a so-called "resource" account which will maintain the list
    /// of lottery tickets bought by users.
    ///
    /// WARNING: For the `lottery` module to be secure, it must be deployed at
    /// the same address as the created resource account. See an example flow
    /// [here](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-framework/sources/resource_account.move).
    fun init_module(resource_account: &signer) {
        let signer_cap = resource_account::retrieve_resource_account_cap(
            resource_account, DEVELOPER_ADDRESS
        );

        // Initialize an AptosCoin coin store there, which is where the lottery bounty will be kept
        coin::register<AptosCoin>(resource_account);

        // Store the signer cap for the resource account in the resource account itself
        move_to(
            resource_account,
            Credentials { signer_cap }
        );
    }

    /// The minimum time the lottery must be open for before anyone can call
    /// `decide_winners`
    public fun get_minimum_lottery_duration_in_secs(): u64 { MINIMUM_LOTTERY_DURATION_SECS }

    /// The price of buying a lottery ticket.
    public fun get_ticket_price(): u64 { TICKET_PRICE }

    /// Allows anyone to (re)start the lottery.
    public entry fun start_lottery() acquires Credentials {
        let info = borrow_global<Credentials>(@lottery);
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
  
    /// Securely wraps around `decide_winners_internal` so it can only be called
    /// as a top-level call from a TXN, preventing **test-and-abort** attacks (see
    /// [AIP-41](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md)).
    entry fun decide_winners() acquires Lottery, Credentials {
        decide_winners_internal();
    }
  
    /// Closes the lottery (if enough time has elapsed & more than 1 user bought
    /// tickets) and draws a random winner.
    fun decide_winners_internal(): address acquires Lottery, Credentials {
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
        let winner_idx = randomness::u64_range(
            0,
            vector::length(&lottery.tickets)
        );
        let winner = *vector::borrow(&lottery.tickets, winner_idx);

        // Pay the winner
        let creds = borrow_global<Credentials>(@lottery);
        let signer = account::create_signer_with_capability(&creds.signer_cap);
        let balance = coin::balance<AptosCoin>(signer::address_of(&signer));

        coin::transfer<AptosCoin>(
            &signer,
            winner,
            balance
        );

        winner
    }
}
```

Note that the `lottery::decide_winners` function is marked as **private** `entry`. 

This is to prevent [test-and-abort attacks](#test-and-abort-attacks), which we discuss later.

Specifically, it ensures that calls to `decide_winners` cannot be made from Move scripts nor from any other functions outside the `lottery` module. Such calls could test the outcome of `decide_winners` and abort, biasing the outcome of the lottery (see [“Test-and-abort attacks”](#test-and-abort-attacks)).

## Open questions

**O1:** Should the `randomness` module be part of `aptos_framework` rather than `aptos_std`? One reason to keep it in `aptos_std` is in case it might be needed by some of the cryptographic modules there (e.g., perhaps interactive ZKP verifiers that use public coins could use the `randomness` module).

**O2:** Support for private `entry `functions might not be fully implemented: i.e., private `entry` functions could still be callable from a Move script. Or perhaps they are not even callable from a TXN. Or perhaps there are current SDK limitations on creating TXNs that call private entry functions.

**O3:** Would it be useful to have events emmitted when `randomness` APIs are called (e.g., to help with [non-deterministic transaction preview issues](#security-consideration-non-deterministic-transaction-outcomes-in-wallet-previews) in wallets)?

**O4:** Should we use a single generic `randomnes::integer<T>(): T` function, which aborts if given a non-integer type, instead of separate `u32_integer`, `u64_integer` (and so on) functions?

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

There is a reference (albeit **dummy**) implementation of the proposed `aptos_std::randomness` API and an actual implementation of the `lottery` example [in this PR](https://github.com/aptos-labs/aptos-core/pull/9581) (which should merge and be available soon [here](https://github.com/aptos-labs/aptos-core/tree/main/aptos-move/move-examples/lottery).)

## Risks and Drawbacks

 > Express here the potential negative ramifications of taking on this proposal. What are the hazards?

### Accidentally re-generating the same randomness

It should be impossible to misuse the API to re-sample a previously-sampled piece of randomness (excluding naturally-arising collisions, of course).

An example of this would be if a developer expects to sample two `u64` integers `n1` and `n2` , but the API only samples once. In other words, `n1` and `n2` always end up equal:

```
let n1 = randomness::u64_integer();
let n2 = randomness::u64_integer();

if (n1 != n2) {
   // This code is never reached.
}
```

### Test-and-abort attacks

Smart contract platforms are an inherently-adversarial environment to deploy randomness in.

The **key problem** with having a Move function’s execution be influenced by on-chain randomness (e.g., by `randomness::u64_integer`), is that the **effects** of its execution can be **tested for** by calling the function from another module (or from a Move script) and **aborting** if the outcomes are not the desired ones.

#### An example attack

Concretely, suppose `lottery::decide_winners` were a `public entry` function instead of a **private** entry function:

```rust
public entry fun decide_winners(): address acquires Lottery, Credentials { /* ... */}
```

Then, a TXN that contains the following Move script could be used to attack it via **test-and-abort**:

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

### Expressivity

Another concern is the **API is not expressive enough**. 

Fortunately, the `randomness::bytes` method should allow implementing any complicated sampling of other objects (e.g., 512-bit numbers). 

Furthermore, if needed, the `randomness` module can be upgraded with extra functionality.

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in in one year? In five years?

See [“Motivation”](#Motivation).

In addition, this proposal could provide a trustworthy randomness beacon for external entities

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

**Not applicable**: This AIP is strictly about the proposed API, and not its cryptographic implementation, which will be the scope of a different, future AIP.

### Suggested developer platform support timeline

> Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable.

It may be worth investigating whether randomness calls (and their outputs) need to be indexed (e.g., it appears useful to have events emitted after calls to `randomness` APIs).

This could be important to make it easier to **publicly-verify** the randomness produced by randapps. Specifically, anyone could look at the `randomness`-related events emitted by a contract to fetch its verifiable history of generated randomness.

### Suggested deployment timeline

> When should community expect to see this deployed on devnet?
> 
> On testnet?
> 
> On mainnet?

See [“Suggested implementation timeline”](#suggested-implementation-timeline): the cryptographic implementation will be the scope of a different, future AIP.

## Security Considerations

> Has this change being audited by any auditing firm?

Not yet, but it will be audited by the time it is deployed. Updates will be posted here (**TODO**).

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

### Security consideration: Non-deterministic transaction outcomes in wallet previews

When sending a transaction to a randapp, wallets will display a _preview_ of the outcome of this TXN (e.g., how many coins will the transacting user be sending out of their account).
Of course, this preview depends on the randomn outcome of the `randomness` API calls and therefore **must** not be trusted as final.

Indeed, users **should** already be aware that their wallet transaction previews are not finalized on chain due to their potential dependencies.
For example, a transaction's execution outcome might change from what was displayed as the preview because the blockchain state that the execution depended on changed.
Similarly, perhaps the execution depended on a call to [`aptos_framework::timestamp::now_seconds()`](https://aptos.dev/reference/move/?branch=mainnet&page=aptos-framework/doc/timestamp.md#0x1_timestamp_now_seconds).

To make it more explicit that the transaction's outcome might not be the same on-chain as previewed in the wallet, a wallet implementation could check if `randomness` events are emitted by that TXN and display an appropriate message to the user.

### Security consideration: Preventing test-and-abort attacks

The defense discussed in [“Test-and-abort attacks”](#test-and-abort-attacks) assumed that developers make proper use of **private** entry functions as the only entry point into their randapp. Unfortuantely, developers are fallible. Therefore, it is important to prevent **accidentally-introduced bugs**.

We discuss two defenses below that we plan to use to enforce the proper usage of **private** `entry` functions as the only gateway into randapps.

#### Linter-based checks

A linter check could be implemented to ensure that the `randomness` function calls that sample objects, such as `randomness::u64_integer`, are only reachable via a call to a `private` entry function.

For example, this is the case in the `lottery` example, where:

- The winner is picked via `randomness::u64_range`,
- ...which is called from the private function `decide_winners_internal`, 
- ...which in turn is only callable from the private `entry ` function `decide_winners`.

**Advantages:**

- This defense could be made part of the default linter checks in the `aptos move` CLI compiler.

**Disadvantages:**

- Some developers could skip over this defense by using a custom compiler or writing bytecode directly.

#### Callstack-based checks

We can inspect the Move VM callstack to check if a `randomness` **native** function was called from outside a `private entry` function, thereby actively preventing test-and-abort attacks.

**Advantages:** 

- This might not be to difficult to implement if `randomness::u64_integer` is a Move native function via `SafeNativeContext` -> `NativeContext` -> `Interpreter` -> `CallStack` -> check `def_is_friend_or_private` of every function in the call stack (need to add a `traverse` function though).
- This defense will **always** work, whereas the linter-based defense can be skipped by some developers.

**Disadvantages:**

- <strike>This defense is rather aggresive as it interferes with the semantics of the Move language by aborting the execution of vulnerable randomness function calls, which would normally proceed without issue.</strike>
   + The randomness functions are native functions. It is perfectly fine to define custom abort semantics for them. It does not break any of the semantics of the Move language.

## Testing (optional)

> What is the testing plan? How is this being tested?

As per [“Suggested implementation timeline”](#suggested-implementation-timeline), the cryptographic implementation will be the scope of a different, future AIP.

The testing plan currently consists of:

- Gathering feedback from the Move ecosystem on the API via AIP discussions, developer discussions, etc.
- Testing that the support for private `entry` functions is fully-implemented in the Move VM
- Testing that the linter-based checks (or the callstack-based checks) do indeed catch misuses of the `randomness` API

## Acknowledgements

Thanks to the individual contributors in [this AIP’s discussion](https://github.com/aptos-foundation/AIPs/issues/185).

Thanks to the Move design review team for their helpful feedback.

Thanks to Kevin Hoang, Igor Kabiljo and Rati Gelashvili for their help on mitigating against _test-and-abort_ attacks.

Thanks to Junkil Park for further simplifying the API.

## Changelog 

For posterity, past versions of this AIP were:

- [v1.0](https://github.com/aptos-foundation/AIPs/blob/4577f34c8df6c52a213223cd62472ea59e3861ef/aips/aip-41.md)
  - Initial version of the `randomness` API
- [v1.1](https://github.com/aptos-foundation/AIPs/blob/3e40b4e630eb8aa517b617799f8e578f5f937682/aips/aip-41.md), 
  - Switched API design to be `RandomNumberGenerator`-based
  - See [diff from v1.0 here](https://github.com/aptos-foundation/AIPs/compare/4577f34c8df6c52a213223cd62472ea59e3861ef..3e40b4e630eb8aa517b617799f8e578f5f937682?short_path=33dc9b1#diff-33dc9b179818e3c972be69b5f214313b233e2338fef599626ebe4895f4e5dc51).
- v1.2 (current):
  - Added protection against _test-and-abort_ attacks
  - Further simplified API by removing the `RandomNumberGenerator` struct.
  - Discussed linter-based checks and callstack-based checks for improper uses of the `randomness` APIs.
  - See [diff from v1.1 here](https://github.com/aptos-foundation/AIPs/compare/3e40b4e630eb8aa517b617799f8e578f5f937682..HEAD).
