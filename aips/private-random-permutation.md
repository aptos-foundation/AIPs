---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Move API for private random permutation
author: Zhoujun Ma (zhoujun@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: <Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Move API for private random permutation
  
## Summary

**Private random permutation** refers to a pattern in a multi-party app where:
- integers $[0, n-1]$ are shuffled and veiled (typically by a special party) in a way unbiasable and unpredictable to normal parties;
- each element can later be revealed either publicly, or privately to a subset of normal participants, according to app-specific rules.

Private random permutation is a generaic building block for dApps and can be widely used in card games (e.g. Poker).

While private random permutation is trivial to implement in a centralized setting where the special party is trusted and has a private communication channel with every normal party,
there is currently no good way to achieve the same in an general dApp setting where normal parties are blockchain users and can only communicate by transacting publicly.
The current [on-chain randomness API](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-41.md) also doesn't solve the problem directly, as the result it produces is public.

This AIP proposes a Move API to provide private random permutation for smart contract,
and can potentially be implemented efficiently on Aptos using threshold cryptography.

### Out of Scope

The actual implementation will be a separate AIP.

# High-level Overview

A prime-ordered group $G$ and its scalar field $F$ needs to be chosen.

- Validators use a secret sharing mechanism to share a secret scalar $s$ and its inverse $s^{-1}$.
- Upon a $n$-permutation request from a transaction,
validators generates:
  - a helper group element $G$ and collaborate to compute and publish $H=s^{-1}G$ (async delivery).
  - $n$ random group elements $C_0, ..., C_{n-1}$ to represent original value $0, ..., n-1$ accordingly.
- Validators collaborate to shuffle and veil all group elements using a multi-party shuffling protocol,
  resulting in $D_0=sC_{i_0}, ..., D_{n-1}=sC_{i_{n-1}}$ and published on chain (async delivery).
- When validators reveil $D_i$ publicly per contract, they collabroate to compute and publish $s^{-1}D_i$ (async delivery).
- When validators reveil $D_j$ privately to a party per contract, where the party has a secret scalar $x$ and published $Y=xG$ on chain (async delivery), they collabroate to compute and publish $V_j = s^{-1}[D_j + Y]$, so recipient party can locally learn the original value as $V_j - xH$.
- When a party reveals an element $P$ that only itself has access to (and others only see the shuffled and veiled view $V_j$), the party publishes a zero-knowledge proof for a secret $x$ such that $xH == V_j-P$.

NOTE: some steps are marked "async delivery". It means the validators have to run some slow protocols offline to compute the reuslt. The result will probably be devliered in a future block via [validator transactions](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-64.md).

## Impact

The proposed AIP should allow you to easily do private shuffling and revealing in your contract as if you were writing a centralized app.

## Alternative solutions

A different approach is to have the parties to run a shuffle protocol (and perhaps most of the protocol logic) off chain,
and only post protocol results on chain.

It requires multi-party computation procotols to be coordinated and executed between normal parties,
which can significant complicate the dApp design and deployment, compared with its centralized variant.
And typically in this approach, to reveal a shuffled and veiled element, all/many users has to contribute,
or additional complexity is needed to handle party disconnection.

## Specification and Implementation Details

### Proposed Move API

```Move
module 0x1::shuffle {
    struct Item {
        veiled_view: GroupElement,

        /// If set, will be one of the `original_elements`.
        public_view: Option<GroupElement>,

        /// Maps a user public key to the corresponding view that allow the user to locally open it.
        user_views: Table<GroupElement, GroupElement>,
    }
    
    struct Permutation {
        generator: GroupElement, // the G.
        s_inv_g: GroupElement, // helper used in `reveal_item_to`.
        original_elements: vector<GroupElement>, // fresh representations of item 0, 1, ...
        shuffled_items: vector<Item>,
        shuffling_state: ShufflingState, // internal states used by validators only.
    }
    
    /// Shuffle `0..n-1` and veil each element with a secret scalar shared between validators.
    /// Save the result under account `host`.
    /// 
    /// NOTE: async operation, result is delivered in the future.
    public fun secure_shuffle(host: &signer, n: u64) {
        // Example result permutation (n=3).
        permutation.generator == G // sampled using on-chain randomness
        permutation.original_elements == [A, B, C] // sampled using on-chain randomness
        permutation.s_inv_g == s_inv * G // in reality it will be an async op!
        permutation.shuffled_items == [s*C, s*A, s*B] // in reality it will be async ops!
        // NOTE: `s` and `s_inv` are secret field element shared between validators.
    }

    /// From the permutation stored in `host`, publicly open the item at position `item_idx` using validator secret.
    ///
    /// NOTE: async operation, result is delivered in the future.
    public fun reveal_item_publicly(host: &signer, item_idx: u64) {
        let perm = borrow_global_mut<Permutation>(address_of(host));
        let item = &mut perm.shuffled_items[item_idx];
        *item.public_view = Some(s_inv * item.unveiled_view); // in reality it will be an async op!
    }

    
    /// From the permutation stored in `host`, reveal the item at position `item_idx` to the whose has public key `epk`.
    ///
    /// NOTE: async operation, result is delivered in the future.
    public fun reveal_item_privately(host: &signer, item_idx: u64, epk: GroupElement) {
        // Charge gas in advance.
        let perm = borrow_global_mut<Permutation>(address_of(host));
        let item = &mut perm.shuffled_items[item_idx];
        // `epk` will be `x*G` where only the the user knows `x`.
        // item.user_views[epk] := secret_inv * (item.veiled_view + epk)
        // The result is equivalent to `item.public_view + secret_inv * x * G`.
        // User can locally unveil by computing `result - x * s_inv_g`.
    }
    
    /// From the permutation stored in `host`, reveal the item at position `item_idx` with ZK proof from someone who has access.
    public fun open_item(host: &signer, item_idx: u64, claim: GroupElement, proof: Proof) {
        // verify proof with claim
        let perm = borrow_global_mut<Permutation>(address_of(host));
        let item = &mut perm.shuffled_items[item_idx];
        item.public_view = Some(claim);
    }

    //
    // Other helper functions.
    //
    
    /// Check whether all async shuffle/reveal tasks are completed.
    public fun all_tasks_finished(host: address): bool;
    
    /// Return the original value of a item, if it has been publicly revealed.
    public fun item_revealed_value(host: address, item_idx: u64): Option<u64> {
        let perm = borrow_global_mut<Permutation>(address_of(host));
        let item = &perm.shuffled_items[item_idx];
        for (idx, ori) in 0..perm.original_elements.enumerate() {
                if item.public_view == Some(ori) {
                        return Some(idx);
                }
        }
        return None;
    }
}
``` 

### Example contract using the API

A simplified and modified poker is implemented as a smart contract below to demonstrate the API usage.

```Move
module 0xcafe::Poker {
    /// user joining, deck shuffling
	const GAME_PHASE__INITIALIZING: u64 = 1;

    /// dealing 2 cards to every player
	const GAME_PHASE__DEALING_HANDS: u64 = 2;

    /// players betting freely; no bet => fold
	const GAME_PHASE__BETTING: u64 = 3;

    /// dealing 3 community cards
    const GAME_PHASE__DEALING_FLOP: u64 = 4;

    /// Revealing hands of players who did not fold
    const GAME_PHASE__SHOWDOWN: u64 = 5;

    /// Winner computed, prize delivered.
	const GAME_PHASE__END: u64 = 6;

    struct GameState {
        deck_signer_cap: SignerCapability,
        max_players: u64,
        players: vector<address>,
        
        /// `epks[i]` stores the public key of player `i`. The key is supposed to be genereate just for this game and thus called "ephemeral".
        /// Revealing a card to a player requires its EPK.
        epks: vector<GroupElement>,
        player_bet_statuses: vector<BetStatus>,
        phase: GamePhase,
    }

    struct BetStatus {
        is_unknown: bool,
        allin_money: Option<AptosCoin>, // real coin!
    }

    /// Called by the game initiator.
    /// Game data will go to `address_of(game_resource)`.
    public fun init(game_resource: &signer, max_players: u64) {
        let (deck_signer, deck_signer_cap) = create_resource_account();
        0x1::shuffle::secure_shuffle(&deck_signer, 52);
        move_to(game_resource, GameState {
            deck_signer_cap,
            max_players,
            players: vector[],
            epks: vector[],
            player_bet_statuses: vector[],
            phase: GAME_PHASE__INITIALIZING,
        });
    }

    /// Invoked by anyone who wants to join.
    /// Each player needs to generate `n` ephemeral key pairs where `n` is the deck size,
    /// then join with the public keys, which will be used by the chain to reveal cards to them privately.
    public fun join(player: &signer, game_resource: address, epk: GroupElement) {
        let game_state = borrow_global_mut<GameState>(game_resource);
        assert!(game_state.phase == GAME_PHASE__INITIALIZING, E_GAME_STARTED_ALREADY);
        assert!(game_state.players.len() < game_state.max_players, E_GAME_ROOM_FULL);
        vector::push_back(&mut game_state.players, address_of(player));
        vector::push_back(&mut game_state.epks, epk);
        vector::push_back(&mut game_state.player_bet_statuses, BetStatus { is_unknown: true, allin_money: None });
    }

    /// Start dealing 2 cards to every player. Anyone can trigger this.
    public fnu deal_hands(game_resource: address) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        assert!(game_state.phase == GAME_PHASE__INITIALIZING, E_BAD_PHASE_CHANGE);
        
        // Ensure shuffle is done.
        let deck_signer = create_signer_with_capability(&game_state.deck_signer_cap);
        assert!(
            0x1::shuffle::all_tasks_finished(address_of(&deck_signer)),
            E_SHUFFLE_IN_PROGRESS
        );
        
        // Start dealing.
        for i in 0..game_state.players.len() {
            0x1::shuffle::reveal_item_privately(&deck_signer, i*2, game_state.epks[i]);
            0x1::shuffle::reveal_item_privately(&deck_signer, i*2+1, game_state.epks[i]);
        }
        game_state.phase = GAME_PHASE__DEALING_HANDS;
    }

    /// Start the betting phase. Anyone can trigger this.
    public fun start_betting(game_resource: address) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        assert!(game_state.phase == GAME_PHASE__DEALING_HANDS, E_BAD_PHASE_CHANGE);
        
        let deck_signer = create_signer_with_capability(&game_state.deck_signer_cap);
        assert!(
            0x1::shuffle::all_task_finished(address_of(&deck_signer)),
            E_HAND_DEALING_INCOMPLETE
        );
        
        game_state.phase = GAME_PHASE__BETTING; {
        game_state.betting_deadline = cur_time() + Duration::from_sec(30);
    }

    /// Called by a player to update its bet status after hands are dealed.
    public fun bet_action(player: &signer, game_resource: address, new_bet_status: BetStatus) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        if game_state.phase == GAME_PHASE__BETTING {
            assert!(cur_time() < game_state.betting_deadline, E_BET_TOO_LATE);
            let player_idx = game_state.players,index_of(address_of(player));
            let cur_bet_status = &mut game_state.player_bet_statuses[player_idx];
            assert!(*cur_bet_status.is_unknown, E_ALREADY_BETTED);
            *cur_bet_status = new_bet_status;
        } else {
            abort(E_NOT_RIGHT_TIME_TO_BET);
        }
    }

    /// Start dealing 3 community cards. Anyone can trigger this.
    public fun deal_flop(game_resource: address) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        if game_state.phase == GAME_PHASE__BETTING {
            assert!(cur_time() >= game_state.betting_deadline, E_BETTING_NOT_FINISHED);
            let deck_signer = create_signer_with_capability(&game_state.deck_signer_cap);
            let flop_start_pos = game_state.players.len() * 2;
            for idx in 0..3 {
                0x1::shuffle::reveal_item_publicly(&deck_signer, flop_start_pos + idx);
            }
            game_state.phase = GAME_PHASE__DEALING_FLOP;
        } else {
            abort(E_BAD_PHASE_CHANGE);
        }
    }

    /// All-in players reveal their hands publicly. Anyone can trigger this.
    public fun showdown(game_resource: address) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        assert!(game_state.phase == GAME_PHASE__DEALING_FLOP, E_BAD_PHASE_CHANGE);

        let deck_signer = create_signer_with_capability(&game_state.deck_signer_cap);
        assert!(0x1::shuffle::all_tasks_finished(address_of(&deck_signer)), E_FLOP_DEALING_INCOMPLETE);
        
        for i in 0..game_state.players.len() {
            if (option::is_some(&game_state.player_bet_statuses[i].allin_money)) {
                0x1::shuffle::reveal_item_publicly(&deck_signer, i*2);
                0x1::shuffle::reveal_item_publicly(&deck_signer, i*2+1);
            }
        }
        
        game_state.phase = GAME_PHASE__SHOWDOWN;
    }

    /// Compute the winner, distribute the prize. Anyone can trigger this.
    public fun end(game_resource: address) {
        let game_state = borrow_global_mut<GameState>(game_resource_addr);
        assert!(game_state.phase == GAME_PHASE__SHOWDOWN, E_BAD_PHASE_CHANGE);

        let deck_signer = create_signer_with_capability(&game_state.deck_signer_cap);
        let deck_addr = address_of(&deck_signer);
        assert!(0x1::shuffle::all_tasks_finished(deck_addr), E_SHOWDOWN_INCOMPLETE);
        
        let flop_start_pos = game_state.players.len() * 2;
        let winner = None;
        let winner_score = -1;
        let prize = AptosCoin::zero();
        
        // Collect prizes, calculate winner in the same pass.
        for i in 0..game_state.players.len() {
            if (option::is_some(&game_state.player_bet_statuses[i].allin_money)) {
                let coin = option::extract(&mut game_state.player_bet_statuses[i].allin_money);
                prize.merge(coin);
                
                let card_vals = vector[
                    0x1::shuffle::item_revealed_value(deck_addr, i*2).unwrap(),
                    0x1::shuffle::item_revealed_value(deck_addr, i*2+1).unwrap(),
                    0x1::shuffle::item_revealed_value(deck_addr, flop_start_pos).unwrap(),
                    0x1::shuffle::item_revealed_value(deck_addr, flop_start_pos+1).unwrap(),
                    0x1::shuffle::item_revealed_value(deck_addr, flop_start_pos+2).unwrap(),
                ];
                let cur_player_score = compute_score(card_vals);
                if cur_player_score > winner_score {
                    winner = Some(i);
                    winner_score = cur_player_score;
                }
            }
        }
        
        // Deliver the prize.
        if let some(idx) = winner {
                prize.transfer_to(game_state.players[idx]);
        }
        
        // Mark the game ended.
        game_state.phase = GAME_PHASE__END;
    }

    fn compute_score(card_vals: vector<u64>): u64 {
        // check card score table...
    }
}
```

## Reference Implementation

TODO

## Testing (Optional)

TODO

## Risks and Drawbacks

### Front-running opportunities

When revealing items using validators shared secrets,
the implementation will likely (leverage validator transaction framework, and therefore) allow validators to see the result before publishing it,
which means validators can front-run to gain some advantage if the smart contract allows it to do so.

DApps using the proposed API needs to be designed in a way where any state change should be denied in the middle of an async revealing.
Currently there is no good way to ensure this at API/implementation level.
Developers have to warned in the documentation.

### Operation latencies

The underlying threshold cryptography can be expensive,
and the latency of the async shuffling/revealing can be a matter of the system usage (how many shuffling/revealing requests being processed/queued in parallel), and it is unclear how to have a worst-case guarantee.

## Security Considerations

TODO

## Future Potential

TODO

## Timeline

### Suggested implementation timeline

N/A

### Suggested developer platform support timeline

 > Describe the plan to have SDK, API, CLI, Indexer support for this feature is applicable. 

...

### Suggested deployment timeline

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

TODO

## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...
