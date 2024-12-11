---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Privacy-preserving pepper service for Keyless accounts
author: Alin Tomescu (alin@aptoslabs.com)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft # <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Informational #<Standard (Core, Networking, Interface, Application, Framework) | Informational | Process>
created: 10/12/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): 61, 81
---

# AIP-X - Privacy-preserving pepper service for Keyless accounts

## Summary

 > Summarize in 3-5 sentences.
 > Define the problem we're solving.
 > How does this document propose solving it.
 > What are the goals and what is in scope? Any metrics?

...

### Out of scope

 > What are we committing to not doing and why are they scoped out?

...

## High-level Overview

 > Define the strawman solution with enough details to make it clear why this is the preferred solution.
 > Please write a 2-3 paragraph high-level overview here and defer writing a more detailed description in [the specification section](#specification-and-implementation-details).

...

## Impact

 > Which audiences are impacted by this change? What type of action does the audience need to take?
 > What might occur if we do not accept this proposal?
 > List out other AIPs this AIP is dependent on
...

## Alternative Solutions

 > Explain why you submitted this proposal specifically over alternative solutions. Why is this the best possible outcome?

...

## Specification and Implementation Details

 > How will we solve the problem? Describe in detail precisely how this proposal should be implemented. Include proposed design principles that should be followed in implementing this feature. Make the proposal specific enough to allow others to build upon it and perhaps even derive competing implementations.

The Aptos Keyless account infrastructure[^aip-61] enables users to generate an Aptos blockchain account directly from an [OpenID Connect (OIDC)](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#oauth-and-openid-connect-oidc) account such as their Google account or Apple account, completely avoiding the need for users to remember a secret key (SK) or a mnemonic.

Key to this technology is **on-chain privacy**: neither the blockchain state nor the TXN history can reveal which OIDC account corresponds to which keyless blockchain account.
Specifically, the address of the keyless blockchain account should not leak anything about the OIDC user, such as their email address or the `sub` field identifying the user in the JSON Web Token (JWT) signed by the OIDC provider.

To provide this level of hiding, the Keyless infrastructure derives the blockchain address of a keyless account by hashing together (1) the `iss` field in the JWT and (2) an [ID commitment (IDC)](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#public-keys).

The **IDC** is a cryptographically-hiding commitment to (1) the OIDC user identity (e.g., the JWT `email` field) and (2) the [managing application's](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#terminology) identity (i.e., the JWT `aud` field).
The IDC is derived by hashing these two pieces of information together with a 256-bit random blinding factor $r$ called a **pepper** as follows[^aip-61-public-key]:

```math
\mathsf{addr\_idc} = H'(\mathsf{uid\_key}, \mathsf{uid\_val}, \mathsf{aud\_val}; r),\ \text{where}\ r\stackrel{\$}{\gets} \{0,1\}^{256}
```

Here,

- $\mathsf{uid\_key}$ indicates which JWT is to be used for the OIDC user identity (either `sub` or `email`)
- $\mathsf{uid\_val}$ is the value of that JWT field
- $\mathsf{aud\_val}$ is the value of the `aud` field indicating the managing application’s identity.

**TODO:** 

- continue motivating the pepper service as a storage layer for $r$ 
- explain pepper service gets JWT, authenticates user and computes the pepper
- revealing the privacy issues with this
- explain how the pepper service can get a ZKPoK of a JWT for `aud` and `sub` together with a blinded hash $H(aud, sub)^u$ for a random $u$ known only by the user
- then, pepper service can do the same validation, except in ZK and reveal $H(aud, sub)^{\mathsf{sk} \cdot u}$ which the user can unblind

---

#### AIP-81 pepper derivation scheme

Recall from AIP-81[^aip-81] that the pepper service derives peppers using a BLS-based[^BLS01] **verifiable unpredictable function (VUF)** with secret key $\mathsf{sk}$:

```math
\texttt{pepper\_base} = H_\mathsf{vuf}(\mathsf{iss\_val}, \mathsf{uid\_key}, \mathsf{uid\_val}, \mathsf{aud\_val})^\mathsf{sk} \in \mathbb{G}\_1
```

Here, $H\_\mathsf{vuf}$ is a hash function mapping an arbitrary number of bytes onto the elliptic curve group $\mathbb{G}\_1$.

#### The pepper-service ZK relation $$\mathcal{R}$$

```math
\mathcal{R}\begin{pmatrix}
    \textbf{x} = (
      \mathsf{blinded\_hash},
      \mathsf{epk},
      \mathsf{exp\_date}, 
      \mathsf{exp\_horizon}, 
      \mathsf{iss\_val}, 
      \mathsf{header}, 
      \mathsf{jwk}, 
      \mathsf{override\_aud\_val}
    ),\\
    \textbf{w} = (
      \mathsf{aud\_val},
      \mathsf{uid\_key},
      \mathsf{uid\_val},
      \sigma_\mathsf{oidc},
      \mathsf{jwt},
      \rho,
      u
    )
\end{pmatrix}
```

**TODO:** explain what it does intuitively

1. Check the OIDC provider ID in the JWT:
   - Assert $\mathsf{iss\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"iss"}]$
2. If using `email`-based IDs, ensure the email has been verified:
   - If $\mathsf{uid\\_key}\stackrel{?}{=}\texttt{"email"}$, assert $\mathsf{jwt}[\texttt{"email\\_verified"}] \stackrel{?}{=} \texttt{"true"}$
3. Check the user’s ID in the JWT:
   - Assert $\mathsf{uid\\_val}\stackrel{?}{=}\mathsf{jwt}[\mathsf{uid\\_key}]$
4. Are we in normal mode (i.e., we are not in recovery mode $\Leftrightarrow \mathsf{override\\_aud\\_val} = \bot$)
   - *Then:* check the managing application’s ID in the JWT: assert $\mathsf{aud\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"aud"}]$
   - *Else:* check that the recovery service’s ID is in the JWT:  assert $\mathsf{override\\_aud\\_val}\stackrel{?}{=}\mathsf{jwt}[\texttt{"aud"}]$
5. Check that the blinded hash is computed correctly:
   1. Assert $\mathsf{blinded\\_hash}\stackrel{?}{=} H\_\mathsf{vuf}(\mathsf{iss\_val}, \mathsf{uid\_key}, \mathsf{uid\_val}, \mathsf{aud\_val})^u$

6. Check the EPK is committed in the JWT’s `nonce` field:
   - Assert $\mathsf{jwt}[\texttt{"nonce"}] \stackrel{?}{=} H’(\mathsf{epk},\mathsf{exp\\_date};\rho)$
7. Check the EPK expiration date is not too far off into the future:
   - Assert $\mathsf{exp\\_date} < \mathsf{jwt}[\texttt{"iat"}] + \mathsf{exp\\_horizon}$
8. Verify the OIDC signature $\sigma_\mathsf{oidc}$ under $\mathsf{jwk}$ over the JWT $\mathsf{header}$ and payload $\mathsf{jwt}$.

> [!TIP]
> Importantly, the ZK proof $\pi$ leaks nothing about the privacy-sensitive inputs in $\textbf{w}$.

> [!NOTE]
> Regarding security:
>
> 1. In normal made (i.e., $\mathsf{override\\_aud\\_val} = \bot$), the $\mathsf{aud\_val}$ over which the VUF is evaluated is a secret witness but is matched in the JWT.
> 2. In recovery made (i.e., $\mathsf{override\\_aud\\_val} \ne \bot$), the $\mathsf{aud\_val}$ over which the VUF is evaluated is a secret witness but is **NOT** matched in the JWT. This allows the recovery service to provide any $\mathsf{aud\_val}$ as input, depending on what application the user selects during recovery. Note that, in this mode, the pepper service does not learn what managing application the user is recovering his account for.

#### A less privacy-preserving ZK relation $\mathcal{R}$

The relation above can be changed to expose the $\textcolor{red}{\mathsf{aud\_val}}$ as a public input rather than a secret witness. This leaks the managing application IDs to the pepper service, but allows it to build a database of application IDs that have been used by Keyless users, which is useful during [account recovery](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#recovery-service).

```math
\mathcal{R}\begin{pmatrix}
    \textbf{x} = (
      \mathsf{blinded\_hash},
      \mathsf{epk},
      \mathsf{exp\_date}, 
      \mathsf{exp\_horizon}, 
      \mathsf{iss\_val}, 
      \textcolor{red}{\mathsf{aud\_val}},
      \mathsf{header}, 
      \mathsf{jwk}, 
      \mathsf{override\_aud\_val}
    ),\\
    \textbf{w} = (
      \mathsf{uid\_key},
      \mathsf{uid\_val},
      \sigma_\mathsf{oidc},
      \mathsf{jwt},
      \rho,
      u
    )
\end{pmatrix}
```

The body of the relation remains the same [as above](#the-pepper-service-zk-relation-mathcalr).

## Reference Implementation

This is just **an informational AIP**. Over time, we may include links to implementations of it.

## Testing

 > - What is the testing plan? (other than load testing, all tests should be part of the implementation details and won’t need to be called out. Some examples include user stories, network health metrics, system metrics, E2E tests, unit tests, etc) 
 > - When can we expect the results?
 > - What are the test results and are they what we expected? If not, explain the gap.

...

## Risks and Drawbacks

 > - Express here the potential risks of taking on this proposal. What are the hazards? What can go wrong?
 > - Can this proposal impact backward compabitibility?
 > - What is the mitigation plan for each risk or drawback?

## Security Considerations

 > - How can this AIP potentially impact the security of the network and its users? How is this impact mitigated?
 > - Are there specific parts of the code that could introduce a security issue if not implemented properly?
 > - Link tests (e.g. unit, end-to-end, property, fuzz) in the reference implementation that validate both expected and unexpected behavior of this proposal
 > - Include any security-relevant documentation related to this proposal (e.g. protocols or cryptography specifications)

...

## Future Potential

 > Think through the evolution of this proposal well into the future. How do you see this playing out? What would this proposal result in one year? In five years?

...

## Timeline

### Suggested implementation timeline

 > Describe how long you expect the implementation effort to take, perhaps splitting it up into stages or milestones.

...

### Suggested developer platform support timeline

 > **Optional:** Describe the plan to have SDK, API, CLI, Indexer support for this feature, if applicable. 

...

### Suggested deployment timeline

 > **Optional:** Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...

---

[^aip-61]: [AIP-61: Keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md), Alin Tomescu
[^aip-61-public-key]: [AIP-61: Keyless accounts, “Public key of a Keyless account”](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-61.md#public-key), Alin Tomescu
[^aip-81]: [AIP-81: Pepper service for Keyless accounts](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-81.md), Zhoujun Ma
[^BLS01]: **Short Signatures from the Weil Pairing**, by Boneh, Dan and Lynn, Ben and Shacham, Hovav, *in Advances in Cryptology --- ASIACRYPT 2001*, 2001
