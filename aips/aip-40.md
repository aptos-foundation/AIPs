---
aip: 40
title: Address Standard v1
author: banool
discussions-to (*optional):
Status: Draft
last-call-end-date (*optional): 07/10/2023
type: Standard
created: 06/18/2023
updated (*optional):
requires (*optional):
---

# AIP-40 - Address Standard v1

## Summary
This standard defines the following:

- What format APIs should return addresses in.
- What formats APIs should accept addresses in.
- How addresses should be displayed.
- How addresses should be stored.

### Out of Scope
Prior discussion has centered around ways to differentiate between addresses, public / private keys, and other representations of data as hex. There has also been discussion around a more compact representation of addresses. This standard is not related to these discussions (which are akin to a v2 standard), it only aims to standardize our existing approach (v1).

## Motivation
Each account / object on the Aptos blockchain is identified by a 32 byte account address. For internal uses, addresses are represented as just that, using a 32 byte sequence. However when transmitting and displaying addresses it is common to use a hex representation. As it stands today there is no standard that defines how these addresses should be represented in each context. Since there are multiple technically correct ways to represent an address, this leads to a fractured ecosystem in which different APIs, tools, and products represent and accept addresses differently. This can lead to issues with querying on-chain data and submitting correct transactions.

## Impact
This AIP only defines a standard. Our intent is that existing APIs will continue to return addresses as they do today so as not to break any downstream users. New products however must conform to this standard.

As such, those who need to take action based on this AIP are generally platform developers, e.g. of APIs, tooling, wallets, etc.

## Rationale

### Alternative: Migrate immediately to a new standard
Instead of defining a v1 standard we could immediately skip to a v2 standard. In this standard we could / would overhaul all identifiers (addresses, public keys, private keys, how we represent resources, bytes, etc). We could do this, but I suspect the discussion, implementation, and migration would take a very long time. So it is best to define a standard for what we have now and look into a v2 standard later.

### Alternative: Represent all addresses in LONG form
In this alternative world we don't display special (see definition below) addresses differently, we just use the LONG form. This would make for a simpler standard but the UX would be poor, people are used to seeing addresses like 0x1. Indeed there is potential for malicious actors to display addresses that look like special addresses but are not, e.g. `0x0{62}1` vs `0x0{63}1`.

## Specification

### Formats

#### `LONG`
Representation:

```rust
0x<64 hex characters>
```

Examples:

```rust
0x0000000000000000000000000000000000000000000000000000000000000001
0x14b6041b77304fe9354aba2e0b1a0ae51d816d0513332ef651a039fac90339cb
0x043ec2cb158e3569842d537740fd53403e992b9e7349cc5d3dfaa5aff8faaef2
```

#### `SHORT`
Representation:

```rust
0x<hex characters, leading zeroes trimmed>
```

Examples:

```rust
0x1
0x14b6041b77304fe9354aba2e0b1a0ae51d816d0513332ef651a039fac90339cb
0x43ec2cb158e3569842d537740fd53403e992b9e7349cc5d3dfaa5aff8faaef2
```

#### `LONG` without `0x` prefix
Same as `LONG`, but without the `0x` prefix.

#### `SHORT` without `0x` prefix
Same as `SHORT`, but without the `0x` prefix.

### Special Addresses
Addresses are considered special if the first 63 characters of the hex string after the 0x prefix are zero. In other words, an address is special if the first 31 bytes are zero and the last byte is smaller than than 0b10000 (15). In other words, special is defined as an address that matches the following regex: ^0x0{63}[0-9a-f]$. In short form this means the addresses in the range from 0x0 to 0xf (inclusive) are special.

This is explained in greater detail in the [reference implementation](https://github.com/aptos-labs/aptos-core/pull/8727).

### Acceptable Input Formats
- APIs and other input fields (e.g. in wallets, sites, etc.) MUST accept addresses in the following formats:
    - `LONG` (with or without leading 0x)
    - `SHORT` for special addresses (with or without leading 0x)
    - Binary (see Binary Representation below)
- They SHOULD NOT accept addresses in the following formats:
    - `SHORT` for non-special addresses (with or without leading 0x)

The principle is things accepting addresses as input should accept all valid representations of addresses that do not introduce phishing concerns / potential for mistakes. This is why `SHORT` is not allowed for non-special addresses, it is too easy to make a mistake (e.g. miss a single leading zero) and interact with the wrong address.

### Display Format
This describes how addresses should be displayed. Display here refers to any time an address is shown to a user, including in web UIs, logs, compiler output, etc.

- Special addresses SHOULD be represented using `SHORT` format.
- All other addresses MUST be represented using `LONG` format.

### Response Format
This section defines how to represent addresses in responses from APIs (such as those exposed by nodes and the indexer) and any other programming interface when using a hex representation.

- Addresses MUST be formatted using the same rules as for [Display format](https://www.notion.so/Aptos-Address-Standard-44fcda44afb943188712339c818760ee?pvs=21).

### At Rest Format
Some systems, such as the indexer processors when writing to storage, store addresses using a string representation.

- Addresses SHOULD be formatted using the same rules as for [Display format](https://www.notion.so/Aptos-Address-Standard-44fcda44afb943188712339c818760ee?pvs=21).

Note: Binary representation of addresses at rest is preferred.

### Binary Format
When using a binary representation, addresses MUST be encoded as BCS in the [canonical format](https://github.com/move-language/move/blob/8f5303a365cf9da7554f8f18c393b3d6eb4867f2/language/move-core/types/src/account_address.rs#L58).

## Reference Implementation
This PR implements a function called `to_standard_string` that formats addresses as a string in a way that conforms to the standard: https://github.com/aptos-labs/aptos-core/pull/8727. The `from_str` implementation on that class is already compliant with the standard.

## Risks and Drawbacks
Given different tools, sites, etc. represent / accept addresses in different ways already, this standard should not further fracture the ecosystem, but rather bring it together. Additionally, we are not planning on making breaking changes to existing APIs. So the risks should be minimal.

## Timeline

### Suggested implementation timeline
As below, this is largely a developer platform focused AIP.

### Suggested developer platform support timeline
N/A, we are not making any changes to existing APIs on the display side. On the ingestion side the node API is already compliant. The indexer API is not, but the v2 indexer stack is coming out soon and we will take this into consideration.

### Suggested deployment timeline
As above.

## Security Considerations
By disallowing accepting SHORT addresses for non-special addresses, we make phishing / mistakes harder (e.g. by attempting to trick users by omitting leading zeroes). I'm not aware of any notable security drawbacks to this AIP.

## Testing
See the test plan of the reference implementation.
