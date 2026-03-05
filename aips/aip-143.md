---
aip: 143
title: "Confidential APT"
author: "@alinush, @sherry-x"
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard
created: 03/04/2026
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP 143 - Confidential APT

---

This proposal introduces **Confidential APT**, a privacy-preserving extension to the Aptos fungible asset model that enables confidential peer-to-peer transfers while preserving the verifiability and security guarantees of the Aptos blockchain.

If a user elects to use this feature, confidential APT allows APT token balances and transfer amounts to remain encrypted on-chain while enabling validators to verify transaction correctness through cryptographic proofs. When users elect to use this feature, sender and recipient addresses remain visible, while amounts and balances are hidden from public observers. Authorized auditors may optionally be granted the ability to decrypt transaction data for compliance purposes.

The goal of Confidential APT is to enable financial privacy for users and institutions while maintaining the transparency and safety properties required for a public blockchain.

---

# Motivation

Public blockchains provide strong transparency guarantees but can expose sensitive financial information. On most blockchains today, transaction amounts and account balances are publicly visible, which can introduce several challenges.

First, publicly visible balances may expose users to security risks such as targeted attacks or financial profiling. Confidential transactions mitigate this risk by concealing balances and transfer amounts while preserving transaction validity.

Second, many real-world financial use cases require confidentiality. Institutional treasury management, employee compensation, token grants, and other financial workflows often cannot operate on fully transparent systems.

Third, confidentiality can be designed for regulatory compatibility. Confidential transactions can support selective disclosure mechanisms, including enabling authorized parties to inspect transactions while preserving privacy for the broader public.

By introducing Confidential APT, the Aptos ecosystem gains a privacy-preserving financial primitive that enables new classes of applications while maintaining protocol integrity.

---

# Specification

Confidential APT introduces encrypted balances and confidential transfers implemented through cryptographic commitments and zero-knowledge proofs.

Balances are stored on-chain in encrypted form. Transactions update encrypted balances using homomorphic operations, allowing validators to apply state transitions without decrypting values.

A confidential transaction contains the following components:

- Encrypted transfer amount
- Cryptographic proof that the transaction is valid
- Updated encrypted balances for sender and recipient

Validators verify the accompanying proof to ensure that:

- The sender possesses sufficient balance
- The transfer amount is within valid bounds
- The transaction preserves asset conservation

Because balances remain encrypted, validators never learn the underlying values while still verifying correctness.

Sender and recipient addresses remain visible to preserve auditability and prevent abuse of the network.

---

# Cryptographic Design

Confidential APT relies on three primary cryptographic components.

### Additively Homomorphic Encryption

Balances are encrypted using a variant of **Twisted ElGamal encryption**. This scheme allows encrypted balances to be updated without revealing the underlying values.

Using homomorphic operations, validators can compute updated encrypted balances directly:

```
EncryptedBalanceSender'    = EncryptedBalanceSender    − EncryptedAmount
EncryptedBalanceRecipient' = EncryptedBalanceRecipient + EncryptedAmount
```

Because the encryption scheme supports additive homomorphism, these updates can occur without decryption.

---

### Zero-Knowledge Proofs

Each confidential transaction includes a zero-knowledge proof that verifies transaction correctness.

The proof ensures that:

- The sender's balance is sufficient
- The transfer amount is valid
- No tokens are created or destroyed

Validators verify these proofs before accepting the transaction.

---

### Range Proofs

Range proofs ensure that encrypted values lie within valid ranges.

These proofs enforce constraints such as:

- Transfer amount ∈ [0, 2⁶⁴)
- Balance ∈ [0, 2¹²⁸)

Range proofs prevent arithmetic overflow attacks and ensure safe encrypted balance updates.

---

# Move Module Interface

The Confidential APT module exposes the following public entry functions.

### Register Encryption Key

```
register(owner_signer, encryption_key, proof)
```

Registers a user’s encryption key used for confidential balances.

---

### Deposit

```
deposit(sender_signer, asset_type, public_amount)
```

Converts publicly visible tokens into confidential balance.

---

### Withdraw

```
withdraw(owner_signer, asset_type, public_amount, proof)
```

Converts confidential balance back into publicly visible tokens.

---

### Confidential Transfer

```
transfer(sender_signer, recipient_address, asset_type, proof)
```

Transfers confidential tokens between accounts.

---

### Key Rotation

```
rotate_key(owner_signer, new_encryption_key, proof)
```

Allows users to rotate encryption keys without exposing balances.

---

### Balance Query

```
balance(owner_address, asset_type) → encrypted_balance
```

Returns the encrypted balance associated with an account.

---

# SDK Interface

Client applications interact with Confidential APT through SDK APIs responsible for key generation, proof creation, and balance decryption.

Example SDK methods include:

```
generate_encryption_key_pair()
generate_transfer_proof()
generate_withdraw_proof()
generate_normalization_proof()
generate_key_rotation_proof()
decrypt_balance()
```

The SDK also provides utilities for calling the corresponding Move module entry functions.

---

# Rationale

The design of Confidential APT balances privacy with verifiability.

Electing to make balances and transfer amounts confidential protects users from on-chain financial attacks and enables institutional adoption. At the same time, keeping sender and recipient addresses visible preserves a level of transparency necessary to prevent abuse and maintain network trust.

The use of homomorphic encryption allows encrypted balances to be updated efficiently, while zero-knowledge proofs ensure transaction validity without exposing private data.

This approach enables confidentiality without requiring fundamental changes to the Aptos consensus or execution model.

---

# Key Design Choices

The design of **Confidential APT** reflects a set of deliberate trade-offs intended to balance confidentiality, security, governance oversight, and long-term ecosystem sustainability.

The system prioritizes strong user privacy guarantees while preserving the ability for the Aptos community to evolve the system through transparent governance.

Users have the option for selective disclosure and can optionally reveal balances and transaction details to trusted parties by sharing a view key.

## Governance-Assigned Auditing

The confidential asset framework is designed to support auditing capabilities, but **no auditor is assigned at launch**.

Instead, the authority to designate an auditor is retained by **on-chain governance** and may be exercised through a future governance proposal.

This ensures that the system launches without a default auditor while preserving the option for regulated or institutional use cases that may require auditability.

### Operational Semantics

If governance assigns an auditor **A** at time **T**, the following rules apply.

The auditor may decrypt:

- Confidential transactions executed **after time T**
- Balances of accounts that perform confidential transactions **after time T**

However, the auditor **cannot decrypt**:

- Transactions executed **before time T**
- Historical balances that existed prior to post-T activity

This model ensures that governance actions **cannot retroactively compromise user confidentiality**.

### Rationale

This design preserves strong privacy guarantees while maintaining governance flexibility.

Key motivations include:

- Preserving user trust at launch
- Removing risks associated with centralized auditor key custody
- Allowing auditing capability if elected by community or governance or required for institutional use cases
- Supporting auditor rotation or revocation through governance
- Aligning confidentiality controls with transparent and accountable decision-making

## Selective Disclosure by User

Users retain control over their confidential data through **selective disclosure**. While balances and transaction amounts remain encrypted by default, users may choose to reveal this information to trusted parties—such as auditors, counterparties, or compliance providers—by sharing the corresponding decryption key or the decrypted history (user can prove to the auditor that the decrypted data is correct, using cryptographic verification methods, ensuring that the revealed information faithfully reflects the on-chain encrypted state). This mechanism allows specific parties to inspect individual account balances and transaction details when necessary, without exposing that information publicly on-chain. As a result, users can maintain strong privacy guarantees while still supporting situations that require transparency or verification.

---

## APT-Only Confidentiality

At launch, confidential asset functionality is **restricted to APT only** and enforced at the framework level.

Other assets cannot opt into the confidential asset system.

This restriction is implemented at the protocol layer rather than through optional token configuration.

### Rationale

Restricting confidentiality to APT ensures consistent security assumptions and aligns the feature with the network’s native asset.

The primary motivations include:

- Preventing dilution of the network’s most advanced confidentiality capability
- Ensuring that privacy-driven utility relates directly to APT
- Avoiding fragmented liquidity across multiple confidential asset variants
- Simplifying auditing, monitoring, and tooling requirements
- Reducing systemic risk during early deployment of a cryptographic feature

This restriction represents a **product and ecosystem decision rather than a technical limitation**. Governance may consider enabling confidential functionality for additional assets in the future, subject to security review, economic alignment, and policy considerations.

---

# Backwards Compatibility

Confidential APT is designed to be fully compatible with the existing Aptos ecosystem.

The system operates alongside standard APT balances, allowing users to convert between public and confidential balances through deposit and withdrawal operations.

No modifications to the Aptos consensus protocol are required.

Existing applications that rely on public balances will continue to function normally.

---

# Ecosystem Impact

The introduction of Confidential APT expands the design space for applications built on Aptos by enabling confidentiality-preserving financial interactions while maintaining verifiability at the protocol level.

Confidential APT introduces a new primitive that developers, wallets, and infrastructure providers can build on top of. While the feature is initially scoped to confidential peer-to-peer transfers, it establishes foundational infrastructure that can support a broader class of privacy-aware applications.

## Wallets and User Experience

Wallets integrating Confidential APT will support the generation and management of encryption keys associated with confidential balances.

Users will interact with confidential balances through wallet interfaces capable of:

- Generating encryption key pairs
- Producing transaction proofs locally
- Decrypting confidential balances for display
- Managing key rotation when necessary

Because confidential balances are encrypted on-chain, wallet software plays an important role in maintaining usability and ensuring users retain access to their funds.

## Developer Ecosystem

Confidential APT introduces new capabilities for developers building on Aptos.

Developers can leverage confidential transfers to build applications where financial information is not publicly exposed. Potential applications include:

- Private payment systems
- Payroll and compensation infrastructure
- Token distribution and grant systems
- Institutional settlement workflows

By providing SDK support for proof generation and encryption management, the confidential asset framework aims to make privacy-preserving applications accessible to developers without requiring deep cryptographic expertise.

## Liquidity and Asset Usage

Restricting confidential transfers to APT ensures that privacy-driven liquidity and usage accrue directly to the native asset of the network.

This design avoids fragmentation of liquidity across multiple confidential asset variants and simplifies risk management during early deployment of a complex cryptographic system.

Over time, governance may evaluate whether extending confidential capabilities to additional assets aligns with ecosystem priorities.

## Institutional and Regulated Use Cases

Confidential APT enables new categories of institutional use cases that require financial privacy but must still operate within transparent systems.

Examples include:

- Confidential treasury operations
- Private payroll and compensation distribution
- Token grant and vesting systems
- Institutional settlement infrastructure

The governance-controlled auditing capability provides a mechanism for supporting compliant use cases or institutional requirements.

## Long-Term Ecosystem Evolution

By introducing confidential balances as a core primitive, Aptos will be positioned to support privacy-aware financial infrastructure as the ecosystem evolves.

Future integrations with staking, governance, and on-chain applications may further expand the role of confidential assets within the network while maintaining the performance and security guarantees of the Aptos blockchain.

# Performance and Gas Cost Impact

Confidential APT transactions introduce additional cryptographic work compared to standard APT transfers. These costs arise primarily from:

- verification of zero-knowledge proofs
- validation of encrypted balance updates
- larger transaction payloads containing ciphertexts and proofs

Despite this additional cryptographic logic, the design targets efficient execution so that confidential transactions remain practical for everyday payments.

## Client-Side Proof Generation

Proof generation occurs entirely on the client side and therefore does not affect validator throughput.

The system is designed so that transaction amounts can be decrypted extremely quickly using chunked encryption and discrete-log lookup tables. With 16-bit chunks, decrypting a transaction amount requires only a few hundred microseconds on modern hardware. 

In prototype benchmarks:

- Decrypting a **16-bit chunk** requires roughly **51 µs**
- A transaction amount composed of multiple chunks can be decrypted in roughly **hundreds of microseconds**

Even accounting for slower browser environments, this design supports **dozens to hundreds of confidential transaction decryptions per second** on consumer devices. 

## Validator Verification Cost

Validators verify the zero-knowledge proofs included in confidential transactions.

These proofs ensure that:

- the sender has sufficient balance
- the transfer amount lies within a valid range
- encrypted arithmetic updates remain consistent

Verification involves elliptic-curve operations and multi-scalar multiplications, which introduce additional execution cost relative to standard transfers.

However, the cryptographic design intentionally uses **specialized sigma protocols and range proofs** rather than general-purpose zkSNARK circuits. This approach significantly reduces verification complexity while avoiding trusted setup requirements. 

## Balance Decryption Considerations

Balances are stored in encrypted form and must occasionally be decrypted client-side.

For balance values up to 32 bits (arising from the selected chunk configuration), a Baby-Step Giant-Step discrete-log computation requires at most \(2^{16}\) group additions, which corresponds to roughly **13 ms in native Rust implementations**. 

In browser environments, the same operation may take approximately **130–260 ms** due to JavaScript overhead. 

These operations occur client-side and therefore do not affect validator performance.

## Gas Pricing Considerations

Because confidential transfers require additional verification work, their gas cost is expected to be higher than standard APT transfers.

Gas consumption arises from:

- proof verification
- ciphertext processing
- additional Move execution logic
- increased transaction size

Exact gas values should be calibrated during devnet and testnet phases based on empirical measurements of validator execution cost.

## Network Performance Impact

The confidential asset design aims to maintain compatibility with the high-throughput execution model of Aptos.

Key performance characteristics include:

- proof generation occurs off-chain
- verification complexity remains bounded and deterministic
- encrypted balance updates use homomorphic operations without decryption

As a result, confidential transactions introduce **modest additional execution overhead** while preserving the core performance properties of the Aptos network.

Further benchmarking and tuning will be performed prior to mainnet deployment to ensure that confidential transactions integrate smoothly with existing throughput targets.

## Benchmark Summary

The following table summarizes approximate performance characteristics observed in prototype implementations of the confidential asset system.

| Operation | Approximate Time | Location |
| --- | --- | --- |
| Proof generation (transfer) | ~25 ms | Client |
| Proof verification | ~2 ms | Validator |
| Amount decryption | ~0.3–0.5 ms | Client |
| Balance decryption (Baby-Step Giant-Step) | ~13 ms (native) / ~130–260 ms (browser) | Client |

These benchmarks reflect early prototype measurements and may vary depending on hardware, implementation language, and optimization level.

Because proof generation and balance decryption occur client-side, validator workload is primarily limited to proof verification and encrypted balance updates.

Further benchmarking will be conducted during devnet and testnet deployments to refine gas pricing and ensure that confidential transactions remain compatible with Aptos throughput targets.

---

# Security Considerations

Confidential APT introduces new cryptographic assumptions and therefore requires careful security analysis.

Range proofs ensure that encrypted balances remain within valid bounds and prevent overflow attacks.

Zero-knowledge proofs enforce transaction correctness and ensure that tokens cannot be created or destroyed during confidential transfers.

Key management represents an additional operational consideration. Users must securely manage their encryption keys to maintain access to confidential balances.

The system may optionally support auditor keys that allow authorized entities to decrypt transaction data when required.

All cryptographic components should undergo extensive security auditing prior to mainnet deployment.

---

# Deployment and Rollout

Deployment of Confidential APT should proceed incrementally.

Initial development and testing already live on testnet, try it here [https://confidential.aptoslabs.com/](https://confidential.aptoslabs.com/)

Mainnet activation should occur only after security audits and governance approval, current estimated timeline is April, 2026.

---

# Future Feature Considerations

The initial scope of Confidential APT is intentionally limited to confidential peer-to-peer transfers. Launching with a constrained feature set allows the network to validate the cryptographic design, operational behavior, and developer experience before expanding functionality.

Over time, and subject to governance approval, security review, and ecosystem readiness, the system may evolve to support additional capabilities.

### Confidential Staking

A future extension may allow APT held in confidential form to participate in the Aptos staking protocol.

Stake balances would remain cryptographically committed but not publicly visible, while the protocol continues to verify validator voting power and enforce slashing and reward distribution.

Confidential staking would allow participants to secure the network without publicly revealing their holdings.

---

### Confidential Governance

Confidential APT may support participation in on-chain governance.

Voting power could be proven using cryptographic proofs of balance ownership while keeping token balances private. Governance outcomes would remain publicly verifiable.

Supporting confidential staking and governance would represent an important milestone in achieving functional parity between Confidential APT and standard APT.

---

### Potential Additional Confidentiality / Privacy Features

The Aptos ecosystem continues to research and explore additional privacy and confidentiality features with stronger guarantees.

Such additional features would require extensive review and governance approval before deployment.

To check out some of the ongoing research, see the work [here](https://docs.google.com/presentation/d/1gROYWWXabwqbxFVGLV4KKOMuQbmvoGjqo502I0W6W7Q/edit?slide=id.g277ae8ab1df_0_0#slide=id.g277ae8ab1df_0_0)

---

### Application and DeFi Integration

As the confidential asset infrastructure matures, confidential APT may integrate with on-chain applications.

Potential integrations include privacy-preserving payments, confidential settlement primitives, and privacy-aware DeFi protocols.

These capabilities would allow developers to build privacy-preserving financial applications within the Aptos ecosystem.
