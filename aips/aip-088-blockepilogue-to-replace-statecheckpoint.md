---
aip: 88
title: BlockEpilogue to replace StateCheckpoint transaction
author: igor-aptos (https://github.com/igor-aptos)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core)
created: 06/06/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): AIP-57
---

# AIP-88 - BlockEpilogue to replace StateCheckpoint transaction
  
## Summary

Introduces BlockEpilogue transaction, which replaces StateCheckpoint transaction at the end of the block, and includes additional information - BlockEndInfo - to surface why block endeded. 
Additional information is needed for gas price estimation, as there is no onchain information of whether a block was full or not otherwise.

## High-level Overview

This is a second part of the AIP-57, which introduced Block Output Size Limit and Conflict-Aware Block Gas Limit. That makes it such that block is cut (i.e. block was full), without obvious onchain information of that.
When user wants to compute gas price to use for submitting transactions, it has no way of knowing if blocks were cut or not.

Additionally, StateCheckpoint currently ties creating root hash with the end of the block. We might be doing "state checkpointing" at different frequency (i.e. every 3 blocks), and so naming of the block-ending transaction is changed to be BlockEpilogue, as a more appropriate name.

Specification of what it currently contains is written here:

```
pub enum Transaction {
    ....

    BlockEpilogue(BlockEpiloguePayload),
}

pub enum BlockEpiloguePayload {
    V0 {
        block_id: HashValue,
        block_end_info: BlockEndInfo,
    },
}

pub enum BlockEndInfo {
    V0 {
        /// Whether block gas limit was reached
        block_gas_limit_reached: bool,
        /// Whether block output limit was reached
        block_output_limit_reached: bool,
        /// Total gas_units block consumed
        block_effective_block_gas_units: u64,
        /// Total output size block produced
        block_approx_output_size: u64,
    },
}
```

Rest API will return transactions in this format:

```
{
    "version":"1912",
    "hash":"0x54a8efc93fc94f5b545dadb63da3d4dc192125c717b336dc446d55a5b553913f",
    "state_change_hash":"0xafb6e14fe47d850fd0a7395bcfb997ffacf4715e0f895cc162c218e4a7564bc6",
    "event_root_hash":"0x414343554d554c41544f525f504c414345484f4c4445525f4841534800000000",
    "state_checkpoint_hash":"0x841a43956ca09a02b1c1cdadc65f24c390170aa666015a2e8f7ec5c9d6a3875f",
    "gas_used":"0",
    "success":true,
    "vm_status":"Executed successfully",
    "accumulator_root_hash":"0x6561976b4560ff25239dffc6cada70e7008dd42fc4d3df2eca6a86b6d2ec384d",
    "changes":[],
    "timestamp":"1719263322836578",
    "block_end_info": {
        "block_gas_limit_reached":false,
        "block_output_limit_reached":false,
        "block_effective_block_gas_units":0,
        "block_approx_output_size":1163
    },
    "type":"block_epilogue_transaction"
}
```

## Impact

StateCheckpoint transaction will stop being produced, and BlockEpilogue will be produced instead.

For users that handle receiving unknown transactions, no issues should occur.
For users that need to handle all transaction, they would need to add handling for the new transaction type.

Additionally, if someone is looking for StateCheckpoint to define the end of the block, better approach would be to look at BlockMetadata for start of the block instead, otherwise they can change to look at BlockEpilogue as well for ending the block.

## Reference Implementation

[https://github.com/aptos-labs/aptos-core/pull/11298](Add BlockEpilogue (replaces StateCheckpoint), with BlockEndInfo)
[https://github.com/aptos-labs/aptos-core/pull/13471](Add BlockEpilogue transaction to the API)
 
## Risks and Drawbacks



## Security Considerations

No obvious security concerns

## Future Potential

## Timeline

To be released with 1.15, and enabled shortly thereafter.

