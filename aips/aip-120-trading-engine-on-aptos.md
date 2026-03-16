---
aip: AIP-120
title: Trading Engine on Aptos
author: igor-aptos, skedia, runtianz, brian
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/598
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: 03/01/2025
---

# AIP-120 - Trading Engine on Aptos
  
## Summary

This AIP is a proposal introduces the Trading Engine, a modular framework for deploying decentralized exchanges (DEXs) on the Aptos blockchain. 
The Trading Engine is designed to deliver high-throughput and low-latency trading, fully leveraging Aptos' unique performance characteristics.
We will start with a pure move implementation, and then based on benchmarking, improve it as appropriate - potentially via moving components of it to native code, allowing for exploiting higher concurrency that BlockSTM allows (like aggregators did), or to make the critical path more efficient (as we recently did with vector and other datastructures). 
Aptos blockchain is uniquely positioned 

### Out of scope

- Fully functional exchange for Spot and Perps

## High-level Overview
On a high level, the Trading Engine consists of three major components
1. Central Limit Order Book (CLOB) - the core component of the Trading Engine that will handle all order matching and execution.
   Providing both efficient and concurrent CLOB, it allows exchanges to have onchain matching, allowing exchange to have full transparency on the matching decisions, without sacrificing performance.
   On a high level, it has three major components
    1. Single Order Book: This is the main order book that keeps track of active orders and their states. The active order
       book is backed by a BigOrderedMap, which is a data structure that allows for efficient insertion, deletion, and matching of the order
       The orders are matched based on time-price priority.
    2. Pending Order Book: This keeps track of pending orders. The pending orders are those that are not active yet. Three
        types of pending orders are supported.
        - Price move up - Trigggered when the price moves above a certain price level
        - Price move down - Triggered when the price moves below a certain price level
        - Time based - Triggered when a certain time has passed
    3. Bulk Order Book: Order book data structure that allows for efficient insertion, deletion, and matching of orders in bulk.
       This is used to optimize the performance of the order book when there are multiple orders to be placed or cancelled
       at the same time. This order book is mainly used by market maker to atomically update orders on multiple price levels on both sides of the book.
    4. Orders: This is a BigOrderMap of order id to order details.
2. Market Engine - Provides a generic trading engine implementation for a market. On a high level, its a data structure,
   that stores the CLOB and provides APIs to place orders, cancel orders, and match orders. The market also acts
   as a wrapper around the order book and pluggable clearinghouse implementation (more details below).
   Upon placement of an order, the market generates an order id and emits an event with the order details - the order id
   is a unique id for the order that can be used to later get the status of the order or cancel the order.

   Market also supports various conditions for order matching like Good Till Cancelled (GTC), Post Only, Immediate or Cancel (IOC).
   GTC orders are orders that are valid until they are cancelled or filled. Post Only orders are orders that are valid only if they are not
   taker orders. IOC orders are orders that are valid only if they are taker orders.

   In addition, the market also supports trigger conditions for orders. An order with trigger condition is not put
   on the order book until its trigger conditions are met. Following trigger conditions are supported:
   - TakeProfit(price): If its a buy order its triggered when the market price is greater than or equal to the price. If
      its a sell order its triggered when the market price is less than or equal to the price.
   - StopLoss(price): If its a buy order its triggered when the market price is less than or equal to the price. If its
      a sell order its triggered when the market price is greater than or equal to the price.
   - TimeBased(time): The order is triggered when the current time is greater than or equal to the time.
3. Pluggable Clearinghouse - The clearinghouse is responsible for managing the settlement of trades and actual transfer of assets between trading parties. The clearinghouse is pluggable,
   allowing for different implementations to be used depending on the specific needs of the exchange (Spot vs Perps for example).
   A clearing house implementation is expected to implement the following APIs
      - settle_trade(taker, maker, is_taker_long, price, size): SettleTradeResult -> Called by the market when there
      is an match between taker and maker. The clearinghouse is expected to settle the trade and return the result. Please 
      note that the clearing house settlment size might not be the same as the order match size and the settlement might also fail.
      - validate_settlement_update(account, is_taker, is_long, price, size): bool -> Called by the market to validate
      an order when its placed. The clearinghouse is expected to validate the order and return true if the order is valid.
      - max_settlement_size(account, is_long, orig_size): Option<u64> -> Called by the market to validate the size
      of the order when its placed. The clearinghouse is expected to validate the order and return the maximum settlement size
      of the order. Checkout clearinghouse_test as an example of the simplest form of clearing house implementation that just tracks
      the position size of the user and does not do any validation.
## Impact

- Anyone who wants to build a high-throughput DEX

## Alternative Solutions

Keeping Trading Engine on the ecosystem to implement, might not allow for all the optimizations that can be done with tight integration with the VM/BlockSTM.

## Specification and Implementation Details

Following are the main APIs supported by the Single Order Book

```
   struct OrderBook<M: store + copy + drop> has store;

    struct SingleOrderMatch<M: store + copy + drop> has drop, copy {
        order: Order<M>,
        matched_size: u64
    }

    /// Checks if the order is a taker order i.e., matched immediatedly with the active order book.
    public fun is_taker_order<M: store + copy + drop>(
        self: &OrderBook<M>,
        price: u64,
        is_buy: bool,
        trigger_condition: Option<TriggerCondition>
    ): bool 
    
    /// Places a maker order to the order book. If the order is a pending order, it is added to the pending order book
    /// else it is added to the active order book. The API aborts if its not a maker order or if the order already exists
    public fun place_maker_order<M: store + copy + drop>(
        self: &mut OrderBook<M>, order_req: OrderRequest<M>
    )
    
    /// Returns a single match for a taker order. It is responsibility of the caller to first call the `is_taker_order`
    /// API to ensure that the order is a taker order before calling this API, otherwise it will abort.
    public fun get_single_match_for_taker<M: store + copy + drop>(
        self: &mut OrderBook<M>,
        price: u64,
        size: u64,
        is_buy: bool
    ): SingleOrderMatch<M>
    
    /// Removes and returns the orders that are ready to be executed based on the current price.
    public fun take_ready_price_based_orders<M: store + copy + drop>(
        self: &mut OrderBook<M>, current_price: u64
    ): vector<Order<M>> 
    
    /// Removes and returns the orders that are ready to be executed based on the time condition.
    public fun take_ready_time_based_orders<M: store + copy + drop>(
        self: &mut OrderBook<M>
    ): vector<Order<M>>

```

Following are the main APIs supported by the Bulk Order Book

```
    /// Returns a single match for a taker order.
    ///
    /// This function should only be called after verifying that the order is a taker order
    /// using `is_taker_order()`. If called on a non-taker order, it will abort.
     public fun get_single_match_for_taker<M: store + copy + drop>(
        self: &mut BulkOrderBook,
        price_time_idx: &mut aptos_experimental::price_time_index::PriceTimeIndex,
        active_matched_order: ActiveMatchedOrder,
        is_bid: bool
     ): OrderMatch<M> {

    /// Cancels a bulk order for the specified account.
    ///
    /// Instead of removing the order entirely, this function clears all active levels
    /// and sets the order to empty state, allowing the same account to place new orders
    /// with the same order ID in the future.
    ///
    /// # Arguments:
    /// - `self`: Mutable reference to the bulk order book
    /// - `price_time_idx`: Mutable reference to the price time index
    /// - `account`: The account whose order should be cancelled
    ///
    /// # Aborts:
    /// - If no order exists for the specified account
    public fun cancel_bulk_order(
        self: &mut BulkOrderBook,
        price_time_idx: &mut aptos_experimental::price_time_index::PriceTimeIndex,
        account: address
    ): (OrderIdType, u64, u64)

    /// Places a new maker order in the bulk order book.
    ///
    /// If an order already exists for the account, it will be replaced with the new order.
    /// The first price levels of both bid and ask sides will be activated in the active order book.
    ///
    /// # Arguments:
    /// - `self`: Mutable reference to the bulk order book
    /// - `price_time_idx`: Mutable reference to the price time index
    /// - `ascending_id_generator`: Mutable reference to the ascending id generator
    /// - `order_req`: The bulk order request to place
    ///
    /// # Aborts:
    /// - If the order request validation fails
    public fun place_bulk_order(
        self: &mut BulkOrderBook,
        price_time_idx: &mut aptos_experimental::price_time_index::PriceTimeIndex,
        ascending_id_generator: &mut AscendingIdGenerator,
        order_req: BulkOrderRequest
    ) : OrderIdType

```

Following are the core set of APIs supported by the Market engine

```
       struct Market<M: store + copy + drop> has store {
        /// Address of the parent object that created this market
        /// Purely for grouping events based on the source DEX, not used otherwise
        parent: address,
        /// Address of the market object of this market.
        market: address,
        // TODO: remove sequential order id generation
        last_order_id: u64,
        order_book: OrderBook<M>
      }
      
    /// Places an order - If its a taker order, it will be matched immediately and if its a maker order, it will simply
    /// be placed in the order book. An order id is generated when the order is placed and this id can be used to
    /// uniquely identify the order for this market and can also be used to get the status of the order or cancel the order.
    /// The order is placed with the following parameters:
    /// - user: The user who is placing the order
    /// - price: The price at which the order is placed
    /// - orig_size: The original size of the order
    /// - is_buy: Whether the order is a buy order or a sell order
    /// - time_in_force: The time in force for the order. This can be one of the following:
    ///  - TIME_IN_FORCE_GTC: Good till cancelled order type
    /// - TIME_IN_FORCE_POST_ONLY: Post Only order type - ensures that the order is not a taker order
    /// - TIME_IN_FORCE_IOC: Immediate or Cancel order type - ensures that the order is a taker order. Try to match as much of the
    /// order as possible as taker order and cancel the rest.
    /// - trigger_condition: The trigger condition
    /// - metadata: The metadata for the order. This can be any type that the clearing house implementation supports.
    /// - max_fill_limit: The maximum fill limit for the order. This is the maximum number of fills to trigger for this order.
    /// This knob is present to configure maximum amount of gas any order placement transaction might consume and avoid
    /// hitting the maximum has limit of the blockchain.
    /// - emit_cancel_on_fill_limit: bool,: Whether to emit an order cancellation event when the fill limit is reached.
    /// This is used ful as the caller might not want to cancel the order when the limit is reached and can continue
    /// that order in a separate transaction.
    /// - callbacks: The callbacks for the market clearinghouse. This is a struct that implements the MarketClearinghouseCallbacks
    /// interface. This is used to validate the order and settle the trade.
    /// Returns the order id, remaining size, cancel reason and number of fills for the order.
    public fun place_order<M: store + copy + drop>(
        self: &mut Market<M>,
        user: &signer,
        price: u64,
        orig_size: u64,
        is_buy: bool,
        time_in_force: u8,
        trigger_condition: Option<TriggerCondition>,
        metadata: M,
        max_fill_limit: u64,
        emit_cancel_on_fill_limit: bool,
        callbacks: &MarketClearinghouseCallbacks<M>
    ): OrderMatchResult
    
    
    /// Similar to `place_order` API but instead of a signer, it takes a user address - can be used in case trading
    /// functionality is delegated to a different address. Please note that it is the responsibility of the caller
    /// to verify that the transaction signer is authorized to place orders on behalf of the user.
    public fun place_order_with_user_addr<M: store + copy + drop>(
        self: &mut Market<M>,
        user_addr: address,
        price: u64,
        orig_size: u64,
        is_buy: bool,
        time_in_force: u8,
        trigger_condition: Option<TriggerCondition>,
        metadata: M,
        max_fill_limit: u64,
        emit_cancel_on_fill_limit: bool,
        callbacks: &MarketClearinghouseCallbacks<M>
    ): OrderMatchResult
    
    /// Similar to `place_order` API but allows few extra parameters as follows
    /// - order_id: The order id for the order - this is needed because for orders with trigger conditions, the order
    /// id is generated when the order is placed and when they are triggered, the same order id is used to match the order.
    /// - emit_taker_order_open: bool: Whether to emit an order open event for the taker order - this is used when
    /// the caller do not wants to emit an open order event for a taker in case the taker order was intterrupted because
    /// of fill limit violation  in the previous transaction and the order is just a continuation of the previous order.
    public fun place_order_with_order_id<M: store + copy + drop>(
        self: &mut Market<M>,
        user_addr: address,
        price: u64,
        orig_size: u64,
        remaining_size: u64,
        is_buy: bool,
        time_in_force: u8,
        trigger_condition: Option<TriggerCondition>,
        metadata: M,
        order_id: u64,
        unique_priority_idx: Option<UniqueIdxType>,
        max_fill_limit: u64,
        emit_cancel_on_fill_limit: bool,
        emit_taker_order_open: bool,
        callbacks: &MarketClearinghouseCallbacks<M>
    ): OrderMatchResult
    
    /// Cancels an order - this will cancel the order and emit an event for the order cancellation.
    public fun cancel_order<M: store + copy + drop>(
        self: &mut Market<M>, user: &signer, order_id: u64
    )
    
    /// Remaining size of the order in the order book.
    public fun get_remaining_size<M: store + copy + drop>(
        self: &Market<M>, user: address, order_id: u64
    ): u64
    
    /// Returns all the pending order ready to be executed based on the oracle price. The caller is responsible to
    /// call the `place_order_with_order_id` API to place the order with the order id returned from this API.
    public fun take_ready_price_based_orders<M: store + copy + drop>(
        self: &mut Market<M>, oracle_price: u64
    ): vector<Order<M>>
    
    
    /// Returns all the pending order that are ready to be executed based on current time stamp. The caller is responsible to
    /// call the `place_order_with_order_id` API to place the order with the order id returned from this API.
    public fun take_ready_time_based_orders<M: store + copy + drop>(
        self: &mut Market<M>
    ): vector<Order<M>>
    
```

Following are the core set of APIs supported by the Clearinghouse. 

```
     struct SettleTradeResult has drop {
        settled_size: u64,
        maker_cancellation_reason: Option<String>,
        taker_cancellation_reason: Option<String>
    }
    
    
    /// Called by the market to validate an order when its placed. 
    /// The clearinghouse is expected to validate the order and return true if the order is valid.
     fun validate_settlement_update(
        market: Object<PerpMarket>,
        account: address,
        is_taker: bool,
        is_long: bool,
        current_px: u64,
        size: u64
    ): bool
    
    
    /// Called by the market to validate the size of the order when its placed. 
    /// The clearinghouse is expected to validate the order and return the maximum settlement size of the order
     fun max_settlement_size<M: store + copy + drop>(
        market: Object<PerpMarket>,
        account: address,
        is_long: bool,
        orig_size: u64,
        metdata: OrderMetadata
    ): Option<u64>
    
    
    /// Called by the market when there is an match between taker and maker. 
    /// The clearinghouse is expected to settle the trade and return the result. Please note that the clearing house 
    /// settlment size might not be the same as the order match size and the settlement might also fail.
    fun settle_trade(
        market: Object<PerpMarket>,
        taker: address,
        maker: address,
        is_taker_long: bool,
        price: u64,
        size: u64
    ): SettleTradeResult
    
```
## Reference Implementation

https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/framework/aptos-experimental/sources/trading/market/market.move

## Testing 

We will measure performance:
- of a single trading pair order book, against variety of conditions:
  - varying levels of match %, num of orders per match, spread of prices users will use
- having multiple trading pairs

## Risks and Drawbacks

- Adding complexity to the Framework 

## Security Considerations

It's a DataStructure, so only security concerns are that there are no bugs, and that behaviour is clearly documented, for the correct implementation of the whole exchange

## Future Potential

Further financial primitives can be implemented, allowing for richer financial markets on Aptos.

## Timeline

### Suggested implementation timeline

TBD

### Suggested developer platform support timeline

TBD

### Suggested deployment timeline

TBD
First versions on devnet in ~ Apr / May 2025
