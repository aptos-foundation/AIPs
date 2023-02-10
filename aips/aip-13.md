---
aip: 13
title: Coin Standard Improvements
author: movekevin
discussions-to: https://github.com/aptos-foundation/AIPs/issues/24
Status: Accepted
last-call-end-date:
type: Standard (Framework)
created: 2023/01/05
updated: 2023/01/26
---

## Summary
Since the launch of the Aptos Mainnet, there are some improvements suggested by the community that will speed up adoption of the Coin standard. Specifically:
1. Implicit coin registration: Currently recipients of a new Coin need to explicitly register to be able to receive it the first time. This creates friction in user experience with exchanges (CEXs and DEXs alike) and also with wallets. Switching to an implicit model where registration is not required will significantly improve UX.
2. Added support for batch transfers: This is a minor convenience improvement that allows an account to send coins, both the network coin (APT) and others, to multiple accounts in a single transaction.

Since (2) is a minor improvement, the rest of this proposal will discuss the details for (1).

## Motivation and Rationale

Currently, in many cases, coins (ERC-20 tokens, including APT) cannot be sent directly to an account if:

- The account has not been created. Aptos_account::transfer or account::create_account needs to be called by another account that can pay for gas. This is generally a slight annoyance but not too big of a pain.
- The account has not registered to receive that coin type. This has to be done for every custom coin (APT is registered by default when creating an account). This is the main cause of complaints/pain.

The primary historical reason for this design is to let an account explicitly opt-in for tokens/coins that they want and not receive random ones they don’t. However, this has led to user and developer pains as they need to remember to register the coin type, especially so when only the recipient account can do this. One important use case that has run into this issue to CEX transfers that involve custom coins.

## Proposal

We can switch to a model where CoinStore (created by registration) is implicitly created upon transfer if it doesn't exist for a specific CoinType. This can be added as a separate flow in aptos_coin, similar to aptos_coin::transfer which implicitly creates an account upon an APT transfer if one doesn't exist. In addition, accounts can choose to opt-out of this behavior if desired. The detailed flow is below:
    1. aptos_coin::transfer_coins<CoinType>(from: &signer, to: address, amount: u64) by default will register the recipient address (create CoinStore) for CoinType if one doesn't exist.
    2. An account can choose to opt-out of (e.g. to avoid receiving spammy coins) by calling aptos_account::set_allow_direct_coin_transfers(false). They can also later revert this with set_allow_direct_coin_transfers(true). By default, any existing accounts before this proposal is implemented and new accounts afterward will be implicitly opted into receiving all coins.

## Implementation
Reference implementation:
- Implicit coin registration: https://github.com/aptos-labs/aptos-core/pull/5871
- Batch transfer support: https://github.com/aptos-labs/aptos-core/pull/5895

## Risks and Drawbacks
Since this is a new flow instead of modifying the existing coin::transfer function, existing dependency on coin::register and coin::transfer should not be affected. There is only one known potential risk: Since an account is opted-in to receiving arbitrary coins by default, they can get spammed by malicious users sending hundreds or thousands of these spammy coins. This can be mitigated:
- Wallets can maintain a known reputable coin list and use it to filter their user's coin list. This is a known standard UX commonly see in other chains/wallets such as Metamask.
- Resources API currently allow pagination, which helps when an account has too many resources. This mitigates any risks of "DDOS" an account by creating too many resources (one CoinStore per arbitrary coin).
- Indexing systems can further help filter out spammy coins. This can be seen with popular explorers on other chains such as Etherscan.

## Timeline
This change can be rolled out to Testnet for testing in the week of 2/1 or 2/8 (PST time).

