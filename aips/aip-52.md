---
aip: 52
title: Automated Account Creation for Sponsored Transactions
author: davidiw
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 10/04/2023
updated (*optional): 12/11/2023
requires (*optional): <AIP number(s)>
---

# AIP-52 - Automated Account Creation for Sponsored Transactions
  
## Summary

Currently, client-side users must create an account before making transactions on the blockchain. In an effort to simplify and speed-up account creation processes, this AIP proposes allowing sponsored transactions when the gas payer is not the primary signer of the transaction to create an account if the primary signer does not exist. 

### Goals

This AIP makes it easier for sponsored transactions to be ignorant of whether or not accounts exist. As result, this will substantially improve the developer experience on Aptos.

## Alternative solutions

While there are discussions around what account v2 might look like for example eliminating on-chain state by default, it remains at best 6 months out from availability on mainnet. The approach taken here seeks to unlock stateless support for sponsored transactions without compromising the account v2 timeline.


## Specification

Current process for sponsored transactions from the perspective of the primary signer:
* The current prologue evaluates if an account exists and whether or not the sequence number is appropriately set.
* During execution, any framework could attempt to access account data, but most account data is not required for transactions that involve acquiring objects, but is for more legacy data types. Specifically, TokenV1 and CoinV1 require access to the `GUID` generator number.
* The epilogue increments the sequence number.

Proposed process:
* Assume an uncreated account is at sequence number 0.
* During execution, if it is a sponsored transaction, check if the account exists, if it does not, explicitly create it. Then execute the transaction.
* The epilogue is unchanged.

Error case:
In circumstances a transaction can be committed to the blockchain but fail to properly execute. In these cases the transaction is considered aborted, the sender is charged gas for the transaction and the sequence number for the sender's account is incremented. In sponsored transactions, the fee payer would cover the gas costs, while the sending account would have the sequence number incremented. This AIP must address a unique case where the account has yet to be created. In these cases, there is no way to actually charge the sending account, because there is no valid account or sequence number to track. For these cases, the following options exist:
* Discard the transaction, that is do not commit it to the blockchain. This is not a good solution as this opens the door to denial of service attacks. The sender of a transaction could run IO or execution intensive transactions and abort at the end of the transaction. The fee payer would never be charged, but the blockchain did non-negligible work.
* Pre-execute the account creation and charge appropriately upon failure. Unfortunately, the current codebase prevents such an improvement as the current code would need to be substantially refactored to allow this form of isolation. Specifically, there would need to be a non-negligible refactoring around transaction sessions.
* Create the account no matter what. Unfortunately, this makes it so that an attacker can pay the minimum gas fee for a transaction to take storage and could result in a fairly cheap way to exhaust storage on Aptos.
* Require that in the case of a sponsored transaction with sequence number 0, the fee payer covers the cost of two storage slots and at least ten times the gas unit price. This guarantees that the transaction has paid sufficient costs for creating the account, so that accounts cannot be made cheaper by going through the abort path.

While option four is not a clean solution, the alternatives would delay other timelines, such as broader refactors of the AptosVM. As a result of this revamp, we can expect that this solution will disappear into lightly maintained legacy code.

There is another challenge associated with this. Should the account be refundable via a deposit upon delete.
* By enabling the refund, the code update is simpler. It also motivates migration from accountv1 to accountv2 by guaranteeing the storage costs are subsidized. The team can also ensure that only accountv1 can be deleted during the creation of an accountv2.
* By disabling the refund, there is no concern that in some fashion, the storage slots produce refunds that were not backed by appropriate charges. This possibility seems unlikely as there are both integration tests and the possibility to validate both in validation of the transaction and during execution.

Option 1 is the more viable path as it both improves the path for migration to account v2, it limits the amount of new code to be written.

## Reference Implementation

Initial code -- https://github.com/aptos-labs/aptos-core/pull/10423
Error case handling -- https://github.com/aptos-labs/aptos-core/pull/11076

## Testing (Optional)

Pointer to an API test that verifies end-to-end of account not existing, being created, and used and then repeated with the account exists.

## Risks and Drawbacks

There may be a slight performance degradation for sponsored transactions. This is unlikely as the storage accesses are cached and the cost will be dominated by something less than a prologue check. The cost is justified by the criticality of this behavior for supporting developer experience. Furthermore, as we launch accountv2 and sunset accountv1, this check can be eliminated.

Application developers using sponsored transactions should be aware that their transaction costs might be higher as account creation is now implicit. This can be mitigated by either assuming that all transactions will result in the higher cost, leveraging simulation, or explicitly charging the amount of gas for the intended operation independent of the account creation.

The biggest drawback is that we introduce a suboptimal solution, in terms of both the way in which there is a best effort gas charge as well as the way storage deposits are checked.

## Timeline

The intended timeline for this AIP is release 1.9 or an earlier release if 1.9 is delayed based upon external product demands.

Note, at the point in time where AccountV2 has been released and adequately solves the need for on-chain account creation before use, this feature will be disabled. The expected timeframe for AccountV2 is sometime in the later half of 2024.
