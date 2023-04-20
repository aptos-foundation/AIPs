---
aip: 23
title: Make Ed25519 Public Key Validation Return False if Key Is the Wrong Length
author: Michael Straka <michael@aptoslabs.com>
Status: Draft
type: Standard (Framework)
created: 03/24/2023
---

# AIP-23 - Make Ed25519 public key validation native return `false` if key has the wrong length
  
## Summary

Changes the function `native_public_key_validate` used by the native Move function `native fun pubkey_validate_internal` to return `false` if the public key provided is the wrong length. Previously, this function would abort if the key length provided was incorrect. This change is gated by a feature flag.  

## Motivation

This feature allows for more flexible error handling by users of the `native_public_key_validate` function. 

## Rationale

Gating behind a feature flag ensures backwards compatibility with previous calls of `native_public_key_validate`, by not changing the behavior of previous transactions before the flag is enabled. 

## Specification

The relevant code in the reference implementation below is as follows:

```
let key_bytes_slice = match <[u8; ED25519_PUBLIC_KEY_LENGTH]>::try_from(key_bytes) {
    Ok(slice) => slice,
    Err(_) => {
        return Err(SafeNativeError::Abort {
            abort_code: abort_codes::E_WRONG_PUBKEY_SIZE,
        });
        if context
            .get_feature_flags()
            .is_enabled(FeatureFlag::ED25519_PUBKEY_VALIDATE_RETURN_FALSE_WRONG_LENGTH)
        {
            return Ok(smallvec![Value::bool(false)]);
        } else {
            return Err(SafeNativeError::Abort {
                abort_code: abort_codes::E_WRONG_PUBKEY_SIZE,
            });
        }
    },
};
```

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/7043

## Risks and Drawbacks

Callers relying on the previous behavior of `native_public_key_validate` may be affected by this change. Currently, end-to-end tests show there are no such callers. Furthermore, it is unlikely that past callers of this function, if any, would be affected if the function returns `false` instead of aborting. This is because such callers would typically need to check the return value of the function anyway & would most likely abort anyway if the return value is `false`.

## Future Potential

Future callers of `native_public_key_validate` will benefit from more flexible error handling, as mentioned above. 

## Suggested implementation timeline

It has already been implemented: see above reference implementation. 

## Suggested deployment timeline

This AIP is planned to be deployed on devnet and then testnet in April, with deployment on mainnet in early May. 
