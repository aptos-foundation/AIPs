---
aip: X
title: Add core events for Fungible Asset Standard
author: bowenyang007, johnchanguk, lightmark
discussions-to (*optional):
Status: In Review
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 07/26/2024
updated (*optional): <mm/dd/yyyy>
---

# AIP-X - Add core events for Fungible Asset Standard

## Summary

Fungible Asset standard is currently missing core events such as mint and burn. This is a problem for indexers and other downstream applications such as analytics tools, dapps, and wallets.

## Motivation

The reason we didn't add those in the first place is because events v1 aren't parallelizable so for performance reason we limited to as few events as possible. However now that we have events v2 that is parallelizable, we should add these events back. Another motivation to doing this now is that Fungible Asset isn't that widely adopted so better adding events sooner rather than later.

**Proposed Solution**


### Alternative Solutions

None

## Specification


## Reference Implementations

https://github.com/aptos-labs/aptos-core/pull/14112

## Risks and Drawbacks


## **Security Considerations**


## Timelines

Next Release

## Future Potentials

None