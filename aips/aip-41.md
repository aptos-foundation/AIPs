---
aip: 41
title: Move APIs for public randomness generation
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/185
Status: Accepted
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 06/27/2023
updated (*optional): <07/28/2023>
requires (*optional): <AIP number(s)>
---

# AIP-41 - Move APIs for public randomness generation

**Version:** 1.3

## Summary

> Include a brief description summarizing the intended change. This should be no more than a couple of sentences. 

This AIP proposes a new Move module called `aptos_framework::randomness` which enables smart contracts to **easily** and **securely** generate publicly-verifiable randomness.

The proposed `randomness` module leverages an underlying _on-chain cryptographic randomness implementation_ run by the Aptos validators. This implementation, however, is **outside the scope** of this AIP and will be the focus of [a different AIP](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-79.md). 

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

## Understanding different types of randomness

### Public randomness versus secret randomness

This AIP describes an API for generating **public** randomness.
This means that everybody will learn the generated randomness.
In other words, there is no way to keep the generated randomness **secret**.
So applications that require **secrecy** should **NOT** use this API.

For example:
 1. You should **not** use this API to generate secret keys
 2. You should **not** use this API to generate blinding factors for hiding commitments
 3. You should **not** use this API to generate a secret preimage of a hash (e.g., [S/KEY](https://en.wikipedia.org/wiki/S/KEY)-like schemes)

Instead, you can safely use this API to publicly generate randomness:
 1. You can use this API to generate Fiat-Shamir challenges in interactive ZK protocols
 2. You can use this API to publicly-pick the winner of a raffle
 3. You can use this API to publicly-distribute airdrops to a list of eligible recipients

### Real randomness versus pseudo-randomness

There is wide-spread confusion about whether **real randomness** should be preferred over (cryptographic) **pseudo-randomness**. 

"Real" randomness comes from random events in the universe (e.g., [radioactive decay](https://www.fourmilab.ch/hotbits/)). 
 
But the problem with "real" randomness is there is **no way** for a smart contract **to verify** that the provided "real" randomness is indeed real. In other words, a malicious randomness beacon could bias the "real" randomness in any way it wants and there would be no way for a smart contract to detect this. 

This is where (cryptographic) pseudo-randomness shines. 
 
Unlike "real" randomness, pseduo-randomness is **cryptographically-verifiable**. This means there is code that one can write in a smart contract to verify the validity of the pseudo-randomness. Furthermore, pseudo-randomness is **provably-indistinguishable** from real randomness, assuming the hardness of certain cryptographic assumptions. In simpler words, no one can tell it's not real randomness anyway (unless they have its associated cryptographic proof and can verify it as a valid pseudo-randomness, of course).

## Rationale

> Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

Instead of having a dedicated module for **on-chain randomness**, as part of the Aptos framework, we could provide Move APIs for verifying **external randomness** from off-chain beacons like [`drand`](https://drand.love) or oracles like Chainlink.

In fact, we have already done this: see this example of a [drand-based Move raffle](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) that relies on the `drand` randomness beacon.

Nonetheless, **relying on an external beacon has several disadvantages**:

1. It is very **easy to misuse** an external randomness beacon
   1. e.g., contract writers could fail to commit to a future `drand` round # whose randomness will be used in the contract and instead accept any randomness for any round #, which creates a fatal biasing attack.
   2. e.g., for external randomness beacons that produce randomness at a fixed interval such as `drand`, clock drift between the beacon and the underlying blockchain forces developers to commit to a far-enough-in-the-future round #. In other words, this adds delay before the underlying dapp can use the randomness.
2. **Randomness is too pricy or produced too slowly**: It is not far fetched to imagine a world where many dapps are actually randapps. In this world, randomness would need to be produced very fast & very cheaply, which is not the case for existing beacons.
3. The external **randomness has to be shipped** to the contract via a TXN, making it more awkward by users to use (e.g., in the [drand-based Move raffle](https://github.com/aptos-labs/aptos-core/tree/ad3b32a7686549b567deb339296749b10a9e4e0e/aptos-move/move-examples/drand/sources) example above, someone, perhaps the winning user, would have to “close” the raffle by shipping in the `drand` randomness with a TXN).

## Specification

> Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

We are proposing a new `aptos_framework::randomness` Move module for generating publicly-verifiable randomness in Move smart contracts.

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
module aptos_framework::randomness {
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

#### Example: A decentralized raffle

This `raffle` module picks a random winner, once a certain amount of tickets have been bought.

```rust
module raffle::raffle {
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::randomness;
    use aptos_std::smart_vector;
    use aptos_std::smart_vector::SmartVector;
    use aptos_framework::coin::Coin;
    use std::signer;

    // We need this friend declaration so our tests can call `init_module`.
    friend raffle::raffle_test;

    /// Error code for when a user tries to initate the drawing but no users bought any tickets.
    const E_NO_TICKETS: u64 = 2;

    /// Error code for when the somebody tries to draw an already-closed raffle
    const E_RAFFLE_HAS_CLOSED: u64 = 3;

    /// The minimum price of a raffle ticket, in APT.
    const TICKET_PRICE: u64 = 10_000;

    /// A raffle: a list of users who bought tickets.
    struct Raffle has key {
        // A list of users who bought raffle tickets (repeats allowed).
        tickets: SmartVector<address>,
        coins: Coin<AptosCoin>,
        is_closed: bool,
    }

    /// Initializes the `Raffle` resource, which will maintain the list of raffle tickets bought by users.
    fun init_module(deployer: &signer) {
        move_to(
            deployer,
            Raffle {
                tickets: smart_vector::empty(),
                coins: coin::zero(),
                is_closed: false,
            }
        );
    }

    #[test_only]
    public(friend) fun init_module_for_testing(deployer: &signer) {
        init_module(deployer)
    }

    /// The price of buying a raffle ticket.
    public fun get_ticket_price(): u64 { TICKET_PRICE }

    /// Any user can call this to purchase a ticket in the raffle.
    public entry fun buy_a_ticket(user: &signer) acquires Raffle {
        let raffle = borrow_global_mut<Raffle>(@raffle);

        // Charge the price of a raffle ticket from the user's balance, and
        // accumulate it into the raffle's bounty.
        let coins = coin::withdraw<AptosCoin>(user, TICKET_PRICE);
        coin::merge(&mut raffle.coins, coins);

        // Issue a ticket for that user
        smart_vector::push_back(&mut raffle.tickets, signer::address_of(user))
    }

    /// Can only be called as a top-level call from a TXN, preventing **test-and-abort** attacks.
    entry fun randomly_pick_winner() acquires Raffle {
        randomly_pick_winner_internal();
    }

    /// Allows anyone to close the raffle (if enough time has elapsed & more than
    /// 1 user bought tickets) and to draw a random winner.
    public(friend) fun randomly_pick_winner_internal(): address acquires Raffle {
        let raffle = borrow_global_mut<Raffle>(@raffle);
        assert!(!raffle.is_closed, E_RAFFLE_HAS_CLOSED);
        assert!(!smart_vector::is_empty(&raffle.tickets), E_NO_TICKETS);

        // Pick a random winner in [0, |raffle.tickets|)
        let winner_idx = randomness::u64_range(0, smart_vector::length(&raffle.tickets));
        let winner = *smart_vector::borrow(&raffle.tickets, winner_idx);

        // Pay the winner
        let coins = coin::extract_all(&mut raffle.coins);
        coin::deposit<AptosCoin>(winner, coins);
        raffle.is_closed = true;

        winner
    }
}
```

Note that the `raffle::randomly_pick_winner` function is marked as **private** `entry`. 

This is to prevent [test-and-abort attacks](#test-and-abort-attacks), which we discuss later.

Specifically, it ensures that calls to `randomly_pick_winner` cannot be made from Move scripts nor from any other functions outside the `raffle` module. Such calls could test the outcome of `randomly_pick_winner` and abort, biasing the outcome of the raffle (see [“Test-and-abort attacks”](#test-and-abort-attacks)).

## Open questions

**O1:** Should the `randomness` module be part of `aptos_std` rather than `aptos_framework`? One reason to keep it in `aptos_std` is in case it might be needed by some of the cryptographic modules there (e.g., perhaps interactive ZKP verifiers that use public coins could use the `randomness` module).

**O2:** Support for private `entry` functions might not be fully implemented: i.e., private `entry` functions could still be callable from a Move script. Or perhaps they are not even callable from a TXN. Or perhaps there are current SDK limitations on creating TXNs that call private entry functions.

**O3:** Would it be useful to have events emmitted when `randomness` APIs are called (e.g., to help with [non-deterministic transaction preview issues](#security-consideration-non-deterministic-transaction-outcomes-in-wallet-previews) in wallets)?

**O4:** Should we use a single generic `randomnes::integer<T>(): T` function, which aborts if given a non-integer type, instead of separate `u32_integer`, `u64_integer` (and so on) functions?

## Reference Implementation

 > This is an optional yet highly encouraged section where you may include an example of what you are seeking in this proposal. This can be in the form of code, diagrams, or even plain text. Ideally, we have a link to a living repository of code exemplifying the standard, or, for simpler cases, inline code.

 - The implementation of the `aptos_framework::randomness` API is [here](https://github.com/aptos-labs/aptos-core/blob/randomnet/aptos-move/framework/aptos-framework/sources/randomness.move).
 - An implementation of the raffle example from this AIP is [here](https://github.com/aptos-labs/aptos-core/tree/randomnet/aptos-move/move-examples/raffle).
 - An implementation of lottery example is here [here](https://github.com/aptos-labs/aptos-core/tree/randomnet/aptos-move/move-examples/lottery).

## Risks and Drawbacks

 > Express here the potential negative ramifications of taking on this proposal. What are the hazards?

### Test-and-abort attacks

Smart contract platforms are an inherently-adversarial environment to deploy randomness in.

**One problem** with having a Move function’s execution be influenced by on-chain randomness (e.g., by `randomness::u64_integer`), is that the **effects** of its execution can be **tested for** by calling the function from another module (or from a Move script) and **aborting** if the outcomes are not the desired ones.

We discuss **mitigations** against this attack [in "Security Considerations" below](security-consideration-preventing-test-and-abort-attacks).

#### An example attack

Concretely, **suppose** `raffle::randomly_pick_winner` were a `public entry` function instead of a **private** entry function:

```rust
public entry fun randomly_pick_winner(): address acquires Raffle, Credentials { /* ... */}
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

        // For this attack to fail, `randomly_pick_winner` needs to be marked as a *private* entry function
        raffle::raffle::randomly_pick_winner();

        let new_balance = coin::balance<aptos_coin::AptosCoin>(attacker_addr);

        // The attacker can see if his balance remained the same. If it did, then
        // the attacker knows they did NOT win the raffle and can abort everything.
        if (new_balance == old_balance) {
            abort(1)
        };
    }
}
```


### Undergasing attacks

**Another problem** occurs when a Move function’s execution branches on a random value.
For example, using an `if` statement on a random value creates two possible execution paths: the "then" branch and the "else" branch.
The problem is these paths could have **different gas costs**: one path could be cheaper while another path could be more expensive in terms of gas.

This would allow an attacker to bias the execution of the function by **undergasing** the TXN that calls it, ensuring only the cheap path executes successfully (while the expensive path always aborts with out of gas).
Note that the attacker would have to repeatedly submit their TXN until the execution randomly takes the cheap path.
As a result, the attacker could be wasting funds for the aborted TXNs that took the expensive path.
Nonetheless, the attack is worth it if the cheap path is sufficiently profitable.

We give an example of a vulnerable application below and discuss **mitigations** against this attack [in "Security Considerations" below](security-consideration-preventing-undergasing-attacks).

#### An example of a vulnerable coin tossing function in a game

A game might toss a coin and take two different execution paths based on it.
This would be vulnerable to an undergasing attack.

_Note:_ Not all helper functions & constants are defined, but the example should make sense nonetheless.

```rust
entry fun coin_toss(player: signer) {
   let player = get_player(player);
   assert!(!player.has_tossed_coin, E_COIN_ALREADY_TOSSED);

   // Toss a random coin
   let random_coin = randomness::u32_range(0, 2);
   if (random_coin == 0) {
       // If heads, give player 100 coins (low gas path; attacker can ensure this always gets executed)
       award_hundred_coin(player);
   } else /* random_coin == 1 */ {
       // If tails, punish player (high gas path; attacker can ensure this never gets executed)
       lose_twenty_coins(player);
       lose_ten_health_points(player);
       lose_five_armor_points(player);
   }
   player.has_tossed_coin = true;
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

### Security consideration: Accidentally re-generating the same randomness

Beyond naturally-arising collisions, it should be impossible to misuse the API to re-sample a previously-sampled piece of randomness.

For example, the code below will independently sample two `u64` integers `n1` and `n2`, which means they are likely to be different numbers, except for some small collision probability.

```
let n1 = randomness::u64_integer();
let n2 = randomness::u64_integer();

if (n1 == n2) {
   // This code is not likely to be reached, except with probability 2^{-32}.
}
```

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

The defense discussed in [“Test-and-abort attacks”](#test-and-abort-attacks) assumed that developers make proper use of **private** entry functions as the only entry point into their randapp. 
Unfortuantely, developers are fallible. 
Therefore, it is important to prevent **accidentally-introduced bugs**.

We discuss two defenses below that we plan to use to enforce the proper usage of **private** `entry` functions as the only gateway into randapps.

#### Linter-based checks

A linter check could be implemented to ensure that the `randomness` function calls that sample objects, such as `randomness::u64_integer`, are only reachable via a call to a `private` entry function.

For example, this is the case in the `raffle` example, where:

- The winner is picked via `randomness::u64_range`,
- ...which is called from the private function `randomly_pick_winner_internal`, 
- ...which in turn is only callable from the private `entry ` function `randomly_pick_winner`.

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

### Security consideration: Preventing undergasing attacks

If developers were aware of undergasing attacks, they could carefully write their contracts to avoid them (e.g., use a commit and execute pattern, where the 1st TXN commits to the randomness and the 2nd TXN executes the outcome, branching on the randomness).
Unfortunately, the subtlety of the attack and its defenses is rather high.
We therefore seek to proactively defend developers.

In our proposed defense, the Move VM would enforce that randomness TXNs always:
 1. Declare their `max_gas` amount to be a sufficiently-high amount (e.g., the maximum allowed gas amount for a TXN),
 2. Lock up the gas in the TXN prologue before execution starts,
 3. Refund the remaining gas in the epilogue.

If the locked up amount is sufficiently high to cover any TXN's execution, this defense ensures that randomness TXNs can never be undergased, completely obviating this class of attacks.

To identify if a TXN uses randomness and, therefore, if the gas lockup should be done, we propose adding a `#[randomness]` annotation to any (private) entry functions that sample randomness:


```rust
#[randomness]
entry fun coin_toss(player: signer)
```

If developers forget to add this annotation, their randomness TXNs would be aborted, ensuring safety against undergasing attacks.
(To ensure liveness, a linter can help them detect missing annotations before their code is compiled.)

_Note:_ Without such an annotation, the VM would have to lock up gas for _all_ TXNs which would affect the Aptos ecosystem (e.g., a dapp that transfers APT might always set the gas to some high amount like 1 APT, assuming that it is not locked up and that the TXN can use most of it; such dapps could now fail because their 1 APT would be locked up).

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

Thanks to Valeria Nikolaenko (a16z Crypto) for pointing out the undergasing attacks.

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
  - Discussed linter-based checks and callstack-based checks to defend against test-and-abort attacks.
  - Discussed undergasing attacks and how to obviate them.
  - See [diff from v1.1 here](https://github.com/aptos-foundation/AIPs/compare/3e40b4e630eb8aa517b617799f8e578f5f937682..HEAD).
