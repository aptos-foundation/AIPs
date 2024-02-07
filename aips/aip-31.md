---
aip: 31
title: Allowlisting for delegation pool
author: wintertoro, michelle-aptos, junkil-park, movekevin, alexfilip2
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated (*optional): 02/07/2024
---

# AIP-31 - Allowlisting for delegation pool

## Summary

This AIP proposes to add a flag in `delegation_pool.move` to allow “permissioned” acceptance of stakers. 

## Motivation

Some delegation pools may require a KYC process before accepting delegated stake for compliance reasons. Since delegation pools are permissionless, this feature gives the pool owner more control over who the delegation pool can accept stake from. 

## Rationale

**Considerations:**

1. By default the allowlist flag would be turned off globally - permissionless
2. If the allowlist flag is turned on, the delegation pool would not accept delegated stake from any stakers by default.
3. The pool **owner** must set an allowlist of wallet addresses it accepts stake from. 
    - Any staker would have to “request” to be added to the allowlist before they can stake to the delegation pool. 
    - However, this “requesting would have to be done via off-chain methods (i.e. privately between the operator and staker. UI-based solutions are being explored as well)
4. If an existing delegator is removed from the allowlist, they cannot add or reactivate stake.
5. The pool **owner** can evict an existing delegator that is not part of the allowlist. This operation will move all the delegator's tokens to “pending unstake”. Noted that these tokens will continue to be locked up until the end of the lockup period, and the existing stake will also continue earnings rewards until the end of the lockup period. At the end of the lockup period, funds will be unstaked, but will continue to sit in the pool until the delegator calls withdraw.
6. Existing pools with the allowlist flag already turned on, can turn it off. Once the allowlist flag is turned off, any staker can add funds to the delegation_pool.
8. There is no explicit blacklisting function. I.e. (all stakers allowed BUT xxxx address). The reason for this is cause the person behind the blacklisted address can always just create a new account address.
## Risks and Drawbacks

Delegation pools with allowlisting will have to manage their own KYC process. 

## Future Potential

This feature may be a requirement for any exchanges, financial institutions, or other entities that want to run a validator using a permissioned delegation pool. 

## Suggested implementation timeline

Targeting end of Q2
