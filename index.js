import { Alchemy } from 'alchemy-sdk'
import dotenv from 'dotenv'
import NftFi from '@nftfi/js'

dotenv.config()

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_RPC_URI = process.env.ALCHEMY_RPC_URI
const FABRICA_V3_CONTRACT_ADDRESS = process.env.FABRICA_V3_CONTRACT_ADDRESS
const FABRICA_V3_TOKEN_ID = process.env.FABRICA_V3_TOKEN_ID
const FABRICA_V3_TOKEN_HOLDER_ADDRESS = process.env.FABRICA_V3_TOKEN_HOLDER_ADDRESS
const LENDER_PRIVATE_KEY = process.env.LENDER_PRIVATE_KEY
const NFTFI_API_KEY = process.env.NFTFI_API_KEY

const createOffer = async () => {
  const nftfi = await NftFi.init({
    config: { api: { key: NFTFI_API_KEY } },
    ethereum: {
      account: { privateKey: `0x${LENDER_PRIVATE_KEY}` },
      provider: { url: `${ALCHEMY_RPC_URI}/${ALCHEMY_API_KEY}` },
    }
  })
  const terms = {
    currency: nftfi.config.erc20.usdc.address,
    // 1 USDC
    principal: 1_000_000,
    // 1.1 USDC
    repayment: 1_100_000,
    // 6 months
    duration: 604_800,
    // 7 days
    expiry: 21_600,
  }
  const lenderBalance = await nftfi.erc20.balanceOf({
    account: { address: nftfi.account.getAddress() },
    token: { address: terms.currency },
  })
  if (BigInt(lenderBalance) < BigInt(terms.principal)) {
    throw new Error(`Lender balance of ${lenderBalance} is lower than principal amount of ${terms.principal}`)
  }
  await nftfi.erc20.approve({
    amount: terms.principal,
    token: { address: terms.currency },
    nftfi: { contract: { name: nftfi.config.loan.fixed.v2_1.name } },
  })
  const createOffer = {
    terms,
    nft: {
      address: FABRICA_V3_CONTRACT_ADDRESS,
      id: FABRICA_V3_TOKEN_ID,
    },
    borrower: { address: FABRICA_V3_TOKEN_HOLDER_ADDRESS },
    nftfi: { contract: { name: nftfi.config.loan.fixed.v2_1.name } },
  }
  console.debug('Creating NFTfi offer...', createOffer)
  const response = await nftfi.offers.create(createOffer)
  if (response.code && response.code >= 400) {
    throw new Error(`Error creating offer: HTTP ${response.code} ${response.message}`)
  }
  if (response.errors != null &&
      typeof response.errors === 'object' &&
      !Array.isArray(response.errors)
  ) {
    const [firstCode, firstError] = Object.entries(response.errors)[0]
    const message =
      Array.isArray(firstError) && typeof firstError[0] === 'string'
        ? `Error creating offer: ${firstCode}: ${firstError[0]}`
        : 'Unknown error creating offer'
    console.error(message, response)
    throw new Error(message)
  }
  const { result } = response
  console.debug('Offer successfully created', result)
}

createOffer()
  .catch((error) => {
    console.error(error)
    throw error
  })
  .then(() => process.exit(0))
  .catch((error) => {
    throw error
  })

