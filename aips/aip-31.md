---
aip: 31
title: Allowlisting for delegation pool
author: wintertoro, michelle-aptos, xingdingw
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: On Hold
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Framework
created: 5/3/2023
updated (*optional): 5/11/2023
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
3. The pool **owner** must set a whitelist of wallet addresses it accepts stake from. 
    - Any staker would have to “request” to be added to the allowlist before they can stake to the delegation pool. 
    - However, this “requesting would have to be done via off-chain methods (i.e. privately between the operator and staker. UI-based solutions are being explored as well)
4. If a whitelisted address is removed from the whitelist, all the staker’s tokens will be immediately moved to “pending unstake”, and staker cannot add additional stake. Noted that tokens will continue to be locked up until the end of the lockup period, and the existing stake will also continue earnings rewards until the end of the lockup period. 
5. At the end of the lockup period, funds will be unstaked, but will continue to sit in the pool until the staker calls distribute. When the staker calls distribute, the funds will go back to the staker’s owner wallet. 
6. Existing pools with the allowlist flag already turned on, can turn it off, and the execution of the change will happen at the next epoch. Once the allowlist flag is turned off, any staker can add funds to the delegation_pool.
    - If there is a pending unstake due to removing a staker from the whitelist, the pending unstake will be cancelled
7. Existing pools with allowlist flag already turned off, can turn it on. And the execution of the change will happen at the next epoch. 
    - Before the epoch change, new stakers can still join this stake pool. After the epoch change, existing stakers will be automatically converted to be part of the whitelist set, and new stakers will have to be added manually by the stake pool owner.
8. There is no explicit blacklisting function. I.e. (all stakers allowed BUT xxxx address). The reason for this is cause the person behind the blacklisted address can always just create a new account address.
## Risks and Drawbacks

Delegation pools with allowlisting will have to manage their own KYC process. 

## Future Potential

This feature may be a requirement for any exchanges, financial institutions, or other entities that want to run a validator using a permissioned delegation pool. 

## Suggested implementation timeline

Targeting end of Q2
