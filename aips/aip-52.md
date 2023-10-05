---
aip: 52
title: Automated Account Creation for Sponsored Transactions
author: davidiw
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 10/04/2023
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-52 - Automated Account Creation for Sponsored Transactions
  
## Summary

This AIP proposes to allow sponsored transactions, one in which the gas payer is not the primary signer of the transaction, to create accounts for the primary signer if it does not exist. Currently when submitting a sponsored transaction an account must first exist. This is an unnecessary friction for using gas fee payer accounts for new accounts. As it means that the gas fee payer solution must first submit an independent transaction to the blockchain.

### Goals

This AIP makes it easier for sponsored transactions to be ignorant of whether or not accounts exist. As result, this will substantially improve the developer experience on Aptos.

## Alternative solutions

While there are discussions around what account v2 might look like and that it has no required on-chain state, it at best 4 months out and this can be launched to mainnet much sooner without requiring us to compromise account v2.

## Specification

Current process for sponsored transactions from the perspective of the primary signer:
* The current prologue evaluates if an account exists and whether or not the sequence number is appropriately set.
* During execution, any framework could attempt to access account data, but most account data is not required for transactions that involve acquiring objects, but is for more legacy data types. Specifically, TokenV1 and CoinV1 require access to the `GUID` generator number.
* The epilogue increments the sequence number.

Proposed process:
* Assume an uncreated account is at sequence number 0.
* During execution, if it is a sponsored transaction, check if the account exists, if it does not, explicitly create it. Then execute the transaction.
* The epilogue is unchanged.

## Reference Implementation

TBD

## Testing (Optional)

Pointer to an API test that verifies end-to-end of account not existing, being created, and used and then repeated with the account exists.

## Risks and Drawbacks

There may be a slight performance degradation for sponsored transactions. This is unlikely as the storage accesses are cached and the cost will be dominated by something less than a prologue check. The cost is justified by the criticality of this behavior for supporting developer experience. Furthermore, as we launch accountv2 and sunset accountv1, this check can be eliminated.

Application developers using sponsored transactions should be aware that their transaction costs might be higher as account creation is now implicit. This can be mitigated by either assuming that all transactions will result in the higher cost, leveraging simulation, or explicitly charging the amount of gas for the intended operation independent of the account creation.

## Timeline

The intended timeline for this AIP is release 1.8.
