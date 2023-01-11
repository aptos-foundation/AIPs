---
aip: 9
title: Token Standard Reserved Properties
author: areshand
discussions-to: https://github.com/aptos-foundation/AIPs/issues/28
Status: Draft
last-call-end-date (*optional):
type: Standard (framework)
created: 01/06/2023
---

## Summary

This proposal introduces framework-reserved properties to

1. prevent properties used by the token framework being changed by creators freely.
2. reserving properties that can be extended to support programmable token behavior ex: token freezing, soulbound token, etc

## Motivation

We have existing token properties used by our token standard to control who can burn the token. However, when the token’s default properties are mutable, creators can add these control properties after the token has been minted. The creator can burn these tokens from collectors. This is a known issue called out in token standard to set the token default properties to be immutable as a best practice.  To prevent this entirely, this proposal is to make it infeasible to update the control properties after the token creation.

The reserved framework properties can be utilized for controlling token behavior to make it programmable. One example is having a framework reserved property to freeze tokens at the token store.

## Specification

We have 3 existing control properties:

- `TOKEN_BURNABLE_BY_CREATOR`
- `TOKEN_BURNABLE_BY_OWNER`
- `TOKEN_PROPERTY_MUTATBLE`

When these 3 properties exist in the TokenData’s default_properties, the creator can use them to control burn and mutation eligibility.  We want to prevent the creators from mutating these framework-reserved properties after the token creation.

Reserve all keys with “TOKEN_” prefix for framework usage. When the creator mutates the token_properties stored with the token or the default_properties stored with the TokenData, we will check if the property name starts with “TOKEN_” and abort the mutation if any properties start with “TOKEN_” prefix.

We add friend functions `add/update_non_framework_reserved_properties`. to the property map module. This function will check all the properties to be added/updated and only non_framework_reserved properties can be added or updated.

```rust
// this function will be called by token mutation methods to add or update token properties
public(friend) fun add_non_framework_reserved_properties(map: &mut PropertyMap, key: String, value: PropertyValue)
public(friend) fun update_non_framework_reserved_properties(map: &mut PropertyMap, key: String, value: PropertyValue)
```

## Risks and Drawbacks

**Overhead of token default property mutation cost**

The validation of framework reserved properties will cost extra gas when calling `mutate_tokendata/token_property` , Currently, when creators mutate the properties, the function loop through all the properties to be mutated and update the property value.  The additional cost would be we need to check if the property key starts with `TOKEN_`.  This cost is very minimal. The current function already did many validations of the string length, key duplication, etc, the overhead of checking if a key has a prefix should have negligible impact on user experience.

## Timelines

The change is to be implemented. Ideally, these should be landed to mainnet in 1/2 weeks and waiting for mainnet release.

## Future Potentials

There will be follow-up AIPs on soulbound token and token freezing leveraging these framework-reserved properties.