---
aip: xxx
title: Cross-Domain Delegation for Derivable Accounts
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/discussions/665
author: 0xmaayan
Status: Draft
type: Standard (Framework)
created: 03/18/2026
---

# AIP-XXX - Cross-Domain Delegation for Derivable Accounts

## Summary

Extends the x-chain derivable account abstraction (AIP-113) to allow a derived account created on one domain (e.g., `decibel.trade`) to authorize other domains (e.g., `some-defi-app.com`) to sign transactions on its behalf. This is achieved by introducing a shared on-chain `AuthorizedDomains` resource and a new `DelegatedV1` signature variant in each chain's authentication function (Ethereum/AIP-122, Solana/AIP-121, Sui/AIP-124), requiring no changes to account addresses or key derivation.

## High-level Overview

Today, cross-chain derived accounts on Aptos are domain-scoped: a user who connects their external wallet on `decibel.trade` gets a derived Aptos account tied to that domain. If the same user visits `some-defi-app.com`, they get a completely different Aptos account — even though the underlying wallet key is the same. This is true regardless of whether the user connects via Ethereum, Solana, or Sui.

This proposal enables **cross-domain delegation**: the user can authorize `some-defi-app.com` to submit transactions from their `decibel.trade`-derived account. The master domain retains full control and can revoke delegation at any time.

### Key Properties

- **Chain-agnostic framework**: The `AuthorizedDomains` resource and management functions are shared across all derivable account types (Ethereum, Solana, Sui). Each chain's authentication function adopts the same delegation pattern.
- **No address migration**: The derived account address is unchanged. Delegation is a pure authorization layer on top of the existing DAA scheme.
- **Backward compatible**: The new `DelegatedV1` signature type is added as a new enum variant to each chain's abstract signature enum. Existing signature variants are unaffected.
- **User-controlled**: Only the account holder (via the master domain) can authorize or revoke domains. There is no admin override.
- **On-chain authorization**: The list of authorized domains is stored as a Move resource under the account, making it transparent and auditable.

## Motivation

Several protocols in the Aptos ecosystem use domain-scoped cross-chain accounts today. While domain scoping provides security isolation, it creates a fragmented user experience:

1. **Liquidity fragmentation**: Assets in a user's `decibel.trade` account cannot be used on other dapps without explicit withdrawal and re-deposit.
2. **Developer friction**: Ecosystem dapps cannot compose with users' existing cross-chain accounts.
3. **Single point of failure**: If the master domain (e.g., `decibel.trade`) goes offline or becomes unavailable, users have no way to access or manage their funds — the account is permanently tied to that domain with no alternative signing path.

Cross-domain delegation solves this by letting the "home" dapp act as the account authority, while other dapps can transact on the user's behalf with explicit permission.

## Impact

- Users with existing domain-scoped cross-chain accounts (Ethereum, Solana, or Sui) can authorize third-party dapps without moving funds.
- Dapp developers can integrate with users' existing derived accounts by requesting delegation.
- The master domain (e.g., `decibel.trade`) retains full authority over which domains are authorized.

## Alternative Solutions

### Global (domain-less) cross-chain accounts

An alternative approach is to remove domain scoping entirely, deriving a single Aptos account per external chain identity. While this has simpler UX, the main concern is security: cross-chain account transaction signing happens in the external wallet (e.g., MetaMask, Phantom), which cannot simulate Aptos transactions. The user only sees a sign-in message with the entry function name — not the full transaction details or effects. Domain scoping with delegation mitigates this: the user explicitly opts in per-domain, limiting blast radius to only the dapps they trust.

### Master dapp as a wallet provider (popup-based)

The master dapp (e.g., `decibel.trade`) could expose itself as a wallet provider — similar to how Petra or WalletConnect work. When a user connects on `some-defi-app.com`, they would select "Decibel Wallet", which opens a popup to `decibel.trade` for signing. The popup signs the message on the master domain (preserving the original domain scope), so no on-chain changes are needed. However, this has several drawbacks: (1) poor UX — the user must connect their wallet twice (once on the dapp, once in the master domain popup) and approve every transaction through the popup, (2) significant infrastructure — the master dapp must build and maintain a wallet provider interface with cross-window communication, and (3) availability dependency — if the master dapp's popup fails to load, the user cannot transact at all.

### Multi-signature co-signing

Another considered approach requires the master domain to co-sign every transaction from a delegated dapp. A new `signature_type` variant would bundle both the user's signature (from the delegated domain) and the master domain's co-signature. While more secure per-transaction, this creates poor UX (popup interruptions for every transaction) and requires the master dapp to be online during every transaction. Delegation trades per-transaction approval for one-time authorization, which is a better UX trade-off for most use cases.

## Specification and Implementation Details

### Part 1: Shared Delegation Framework

The delegation framework is chain-agnostic and shared across all derivable account types. It lives in a shared module (e.g., `common_account_abstractions_utils`) so that Ethereum, Solana, and Sui authentication functions all use the same resource and management functions.

#### AuthorizedDomains Resource

A Move resource stored under each derived account that maintains the list of domains authorized for delegation:

```move
struct AuthorizedDomains has key {
    domains: vector<String>,
}
```

This resource is chain-agnostic — an Ethereum-derived account, a Solana-derived account, and a Sui-derived account each have their own `AuthorizedDomains` at their respective addresses (which are different even for the same user, because address derivation includes the authentication function).

#### Management Entry Functions

Two entry functions for managing delegations, callable from any derived account:

```move
public entry fun authorize_domain(
    account: &signer,
    domain: String,
) acquires AuthorizedDomains {
    let addr = signer::address_of(account);
    if (!exists<AuthorizedDomains>(addr)) {
        move_to(account, AuthorizedDomains { domains: vector[] });
    };
    let authorized = borrow_global_mut<AuthorizedDomains>(addr);
    if (!authorized.domains.contains(&domain)) {
        authorized.domains.push_back(domain);
    };
}

public entry fun revoke_domain(
    account: &signer,
    domain: String,
) acquires AuthorizedDomains {
    let addr = signer::address_of(account);
    if (exists<AuthorizedDomains>(addr)) {
        let authorized = borrow_global_mut<AuthorizedDomains>(addr);
        let (found, idx) = authorized.domains.index_of(&domain);
        if (found) {
            authorized.domains.remove(idx);
        };
    };
}
```

#### Delegation Verification (shared helper)

A shared helper function that each chain's authentication function calls when handling the `DelegatedV1` variant:

```move
public fun verify_delegation(sender_addr: address, delegated_domain: &String) {
    assert!(exists<AuthorizedDomains>(sender_addr), EUNAUTHORIZED_DOMAIN);
    assert!(
        borrow_global<AuthorizedDomains>(sender_addr)
            .domains.contains(delegated_domain),
        EUNAUTHORIZED_DOMAIN
    );
}
```

### Part 2: Chain-Specific Changes

Each chain's authentication module adds a `DelegatedV1` variant to its abstract signature enum. The pattern is identical across all chains — the `DelegatedV1` variant carries the `delegated_domain`, and the authentication function:

1. Calls the shared `verify_delegation` to check that the `delegated_domain` (from the signature) is in the account's `AuthorizedDomains` list.
2. Uses `delegated_domain` (instead of `abstract_public_key.domain`) to reconstruct the signing message, since the external wallet signed against the delegated dapp's domain
3. Verifies the wallet signature against the reconstructed message

#### Ethereum (AIP-122)

New enum variant added to `SIWEAbstractSignature` (tag `0x02`):

```move
enum SIWEAbstractSignature has drop {
    /// Tag 0x00 - Deprecated
    MessageV1 { issued_at: String, signature: vector<u8> },
    /// Tag 0x01 - Current standard
    MessageV2 { scheme: String, issued_at: String, signature: vector<u8> },
    /// Tag 0x02 - Delegated signing
    DelegatedV1 {
        delegated_domain: String,
        scheme: String,
        issued_at: String,
        signature: vector<u8>,
    },
}
```

Authentication logic for the `DelegatedV1` case:

```move
DelegatedV1 { delegated_domain, scheme, issued_at, signature } => {
    verify_delegation(sender_addr, &delegated_domain);
    // Reconstruct SIWE message using delegated_domain (not master domain)
    verify_ethereum_signature(
        &abstract_public_key.ethereum_address,
        delegated_domain.bytes(),
        entry_function_name, digest_utf8,
        issued_at.bytes(), scheme.bytes(), &signature,
    );
},
```

The key insight: the SIWE message is reconstructed using `delegated_domain` because the Ethereum wallet signs the message with the actual `window.location.host` of the dapp the user is on. MetaMask and other wallets enforce this domain check.

SIWE message as seen by the user:

```
some-defi-app.com wants you to sign in with your Ethereum account:
0xC7B576Ead6aFb962E2DEcB35814FB29723AEC98a

Please confirm you explicitly initiated this request from some-defi-app.com.
You are approving to execute transaction 0x1::aptos_account::transfer
on Aptos blockchain (mainnet).

URI: https://some-defi-app.com
Version: 1
Chain ID: 1
Nonce: 0x2a2f07c32382a94...
Issued At: 2026-03-18T12:00:00.000Z
```

#### Solana (AIP-121)

New enum variant added to `SIWSAbstractSignature`:

```move
enum SIWSAbstractSignature has drop {
    /// Existing variant
    MessageV1 { signature: vector<u8> },
    /// Delegated signing
    DelegatedV1 {
        delegated_domain: String,
        signature: vector<u8>,
    },
}
```

Authentication logic for the `DelegatedV1` case:

```move
DelegatedV1 { delegated_domain, signature } => {
    verify_delegation(sender_addr, &delegated_domain);
    // Reconstruct SIWS message using delegated_domain
    let message = construct_message(
        &base58_public_key, delegated_domain.bytes(),
        entry_function_name, digest_utf8,
    );
    // Verify Ed25519 signature
    assert!(
        ed25519::signature_verify_strict(&signature, &public_key, message),
        EINVALID_SIGNATURE
    );
},
```

SIWS message as seen by the user:

```
some-defi-app.com wants you to sign in with your Solana account:
<base58_public_key>

Please confirm you explicitly initiated this request from some-defi-app.com.
You are approving to execute transaction 0x1::aptos_account::transfer
on Aptos blockchain (mainnet).

Nonce: 0x2a2f07c32382a94...
```

#### Sui (AIP-124)

New enum variant added to `SuiAbstractSignature`:

```move
enum SuiAbstractSignature has drop {
    /// Existing variant
    SuiDerivedSignature { signature: vector<u8> },
    /// Delegated signing
    DelegatedV1 {
        delegated_domain: String,
        signature: vector<u8>,
    },
}
```

Authentication logic follows the same pattern — verify delegation, reconstruct message with `delegated_domain`, verify the Sui Ed25519 + Blake2b signature.

### Part 3: SDK / Client-Side Changes

The SDK changes are symmetric across all chain packages (`derived-wallet-ethereum`, `derived-wallet-solana`, `derived-wallet-sui`).

#### Account Domain vs Signing Domain

Two domain concepts are introduced:

- **`accountDomain`**: The master domain used to derive the Aptos account address. Included in `abstractPublicKey`.
- **`signingDomain`**: The actual `window.location.host` where the signing message is created. Included in `abstractSignature` when delegated.

When `signingDomain !== accountDomain`, the SDK produces a `DelegatedV1` authenticator:

```typescript
AccountAuthenticator::Abstraction {
    function_info: "<chain_authentication_function>",
    auth_data: AbstractionAuthData::DerivableV1 {
        signing_message_digest: aptos_txn_digest,
        abstract_signature: bcs::to_bytes(<ChainAbstractSignature>::DelegatedV1 {
            delegated_domain: signing_domain,  // e.g. "some-defi-app.com"
            // ...chain-specific fields (scheme, issued_at for Ethereum)...
            signature: wallet_signature,
        }),
        abstract_public_key: bcs::to_bytes(<ChainAbstractPublicKey> {
            identity,                          // ethereum_address / base58_public_key / sui_address
            domain: account_domain,            // e.g. "decibel.trade"
        }),
    },
}
```

#### Delegation Modes

The SDK supports two complementary delegation modes. Dapps can use either or both depending on their needs.

**Mode 1: Wallet-level delegation**

The `masterDomain` is configured at wallet initialization time. All transactions from this wallet use the master domain's derived account:

```typescript
setupAutomaticEthereumWalletDerivation({
  defaultNetwork: Network.MAINNET,
  masterDomain: "decibel.trade",
});
```

This causes the wallet to use `"decibel.trade"` as the `accountDomain` for address derivation and `window.location.host` as the `signingDomain` for message signing. The connected account shown in the UI is the master domain's account.

Use this mode when the dapp exclusively operates on a master domain's account (e.g., a DeFi protocol composing with Decibel accounts).

**Mode 2: Per-transaction delegation**

The `masterDomain` is passed per-call to `signTransaction` or `signAndSubmitTransaction`. The wallet connects with the dapp's own domain-scoped account by default, and individual transactions can target a different master domain's account:

```typescript
const { signTransaction, signAndSubmitTransaction } = useWallet();

// Sign a pre-built transaction with delegation
await signTransaction({
  transactionOrPayload: rawTxn,
  masterDomain: "decibel.trade",
});

// Build, sign, and submit with delegation
await signAndSubmitTransaction({
  sender: masterDomainDerivedAddress,
  data: {
    function: "0x1::coin::transfer",
    functionArguments: [recipient, amount],
  },
  masterDomain: "decibel.trade",
});
```

Use this mode when the dapp wants to show the user's local derived account in the UI but submit certain transactions through a master domain's account. The dapp must supply the correct `sender` address (derived from the master domain) when using `signAndSubmitTransaction`.

When `masterDomain` is provided per-transaction, it overrides any wallet-level `masterDomain` for that specific call.

#### Interface Changes

The `signTransaction` method across the adapter stack (`useWallet` hook, `WalletProvider`, `WalletCore`, and derived wallet implementations) accepts an optional `masterDomain`:

```typescript
signTransaction(args: {
  transactionOrPayload: AnyRawTransaction | InputTransactionData;
  asFeePayer?: boolean;
  masterDomain?: string;  // Per-transaction delegation
}): Promise<{ authenticator: AccountAuthenticator; rawTransaction: Uint8Array }>;
```

The `InputTransactionData` type (used by `signAndSubmitTransaction`) also accepts `masterDomain`:

```typescript
type InputTransactionData = {
  sender?: AccountAddressInput;
  data: InputGenerateTransactionPayloadData;
  options?: InputGenerateTransactionOptions;
  masterDomain?: string; // Per-transaction delegation
};
```

At the wallet-standard boundary, the derived wallet's `signTransaction` method accepts an optional third parameter:

```typescript
async signTransaction(
  rawTransaction: AnyRawTransaction,
  asFeePayer?: boolean,
  options?: { masterDomain?: string },
): Promise<UserResponse<AccountAuthenticator>>
```

When `options.masterDomain` is provided, the derived wallet uses it as the `accountDomain` for that transaction instead of the wallet-level `this.accountDomain`. The `signingDomain` always remains `window.location.host`.

### User Flow

#### One-time setup (on master domain)

1. User connects their cross-chain wallet on `decibel.trade`
2. User navigates to delegation / connected apps settings
3. User authorizes `some-defi-app.com` by submitting an `authorize_domain` transaction
4. On-chain `AuthorizedDomains` resource is created/updated under the user's derived account

#### Transaction signing (on delegated domain — wallet-level)

1. User visits `some-defi-app.com` and connects the same cross-chain wallet
2. The dapp is configured with `masterDomain: "decibel.trade"` at wallet setup
3. The derived Aptos address matches the `decibel.trade` account (same wallet key + same master domain in `abstractPublicKey`)
4. User signs a transaction — the sign-in message uses `domain: "some-defi-app.com"`
5. The SDK produces a `DelegatedV1` authenticator with `delegated_domain: "some-defi-app.com"`
6. On-chain verification:
   a. Checks `AuthorizedDomains` exists for the sender
   b. Checks `"some-defi-app.com"` is in the authorized list
   c. Reconstructs the signing message using `"some-defi-app.com"` as the domain
   d. Verifies the wallet signature against the reconstructed message

#### Transaction signing (on delegated domain — per-transaction)

1. User visits `some-defi-app.com` and connects the same cross-chain wallet (no `masterDomain` configured at wallet level)
2. The UI shows the user's `some-defi-app.com`-scoped derived account
3. For a specific transaction, the dapp calls `signTransaction({ transactionOrPayload: rawTxn, masterDomain: "decibel.trade" })`
4. The SDK overrides `accountDomain` to `"decibel.trade"` for this transaction only
5. The sign-in message still uses `domain: "some-defi-app.com"`, and the authenticator is `DelegatedV1`
6. On-chain verification is identical to the wallet-level flow above

#### Revocation (on master domain)

1. User calls `revoke_domain("some-defi-app.com")` from the master domain
2. Future transactions from `some-defi-app.com` will fail with `EUNAUTHORIZED_DOMAIN`

## Reference Implementation

- **On-chain (Move)**: Changes to `ethereum_derivable_account`, `solana_derivable_account`, `sui_derivable_account`, and `common_account_abstractions_utils` in `aptos-core`
- **SDK (TypeScript)**: Changes to derived wallet packages (`@aptos-labs/derived-wallet-ethereum`, `@aptos-labs/derived-wallet-solana`, `@aptos-labs/derived-wallet-sui`) and adapter core/react packages (`@aptos-labs/wallet-adapter-core`, `@aptos-labs/wallet-adapter-react`) in `aptos-wallet-adapter`
- **Wallet Standard**: The `AptosSignTransactionMethod` type in `@aptos-labs/wallet-standard` should be updated to accept an optional third `options` parameter for per-transaction delegation

## Testing

- Unit tests for `authorize_domain` and `revoke_domain` (add, deduplicate, remove)
- Unit tests for `DelegatedV1` signature deserialization for each chain
- Unit tests for `authenticate_auth_data` with `DelegatedV1` variant for each chain
- E2E test with two local dapps: master domain authorizes a delegated domain, delegated domain signs and submits a transaction successfully
- Negative test: transaction from unauthorized domain fails with `EUNAUTHORIZED_DOMAIN`

## Security Considerations, Risks and Drawbacks

- **Delegation is explicit and user-initiated**: Only the account owner (from the master domain) can authorize domains. This requires a signed on-chain transaction, providing a strong authorization guarantee.
- **Domain verification by wallet**: For Ethereum, the wallet (MetaMask, etc.) enforces that the SIWE `domain` field matches the actual website origin. For Solana, Phantom enforces SIWS domain validation. A phishing site cannot forge a signature for a different domain. For Sui, `domain` is included in the message text but not enforced by the wallet — users must verify the domain in the message themselves (same limitation as existing AIP-124).
- **Revocation is immediate**: Once `revoke_domain` is called, subsequent transactions from the revoked domain will fail. There is no grace period or caching.
- **On-chain storage cost**: Each authorized domain adds to the `AuthorizedDomains` vector. For typical use cases (a handful of dapps), this is negligible.
- **No simulation in wallet**: As with all cross-chain DAA flows, the external wallet cannot simulate the Aptos transaction. The user sees the entry function name and domain in the sign-in message but not the full transaction details. This is unchanged from the existing behavior.
- **Master domain trust**: Users must trust the delegated dapp not to submit malicious transactions. This is similar to granting a dapp permission to interact with your wallet — delegation does not restrict which entry functions can be called. Future work could add per-domain permission scoping.

## Future Potential

- **Per-domain permission scoping**: Extend `AuthorizedDomains` to include a list of allowed entry functions per domain, providing finer-grained access control.
- **Expiration**: Add optional TTL to domain authorizations so they auto-expire.

## Timeline

### Suggested implementation timeline

March 2026

### Suggested developer platform support timeline

April 2026

### Suggested deployment timeline

TBD — pending review and testing on devnet/testnet.
