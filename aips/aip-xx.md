---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Allowlisting for delegation pool
author: michelle-aptos, xingdingw
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated (*optional): 5/3/2023
---

# AIP-X - Allowlisting for delegation pool

## Summary

This AIP proposes to add a flag in `delegation_pool.move` to allow “permissioned” acceptance of stakers. 

## Motivation

Some delegation pools may require a KYC process before accepting delegated stake for compliance reasons. Since delegation pools are permissionless, this feature gives the pool owner more control over who the delegation pool can accept stake from. 

## Rationale

**Considerations:**

1. by default the allowlist flag would be turned off globally - permissionless
2. If the allowlist flag is turned on, the delegation pool would not accept delegated stake from any stakers by default.
3. The pool **owner** must set a whitelist of wallet addresses it accepts stake from. Any staker would have to “request” to be added to the allowlist before they can stake to the delegation pool. 

## Risks and Drawbacks

Delegation pools with allowlisting will have to manage their own KYC process. 

## Future Potential

This feature may be a requirement for any exchanges, financial institutions, or other entities that want to run a validator using a permissioned delegation pool. 

## Suggested implementation timeline

Targeting end of Q2
