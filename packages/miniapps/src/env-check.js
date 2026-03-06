#!/usr/bin/env node
'use strict'

/**
 * baseskills env-check
 * Validates that all environment variables point to the same network
 * before any deploy. Catches the "mainnet paymaster + testnet contract" class of bugs.
 *
 * Lesson learned: BaseRank shipped with Sepolia contract address, mainnet
 * paymaster URL, and testnet chainId all pointing at different environments
 * simultaneously. This gate prevents that class of misconfiguration.
 */

const NETWORKS = {
  mainnet: {
    chainId: 8453,
    chainName: 'base',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    paymasterUrlPattern: /\/rpc\/v1\/base\//,
    rpcUrl: 'https://mainnet.base.org',
  },
  testnet: {
    chainId: 84532,
    chainName: 'base-sepolia',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    paymasterUrlPattern: /\/rpc\/v1\/base-sepolia\//,
    rpcUrl: 'https://sepolia.base.org',
  },
}

const BLOCKERS = []
const WARNINGS = []

function check(label, pass, msg) {
  if (!pass) BLOCKERS.push(`[BLOCKER] ${label}: ${msg}`)
}

function warn(label, msg) {
  WARNINGS.push(`[WARN] ${label}: ${msg}`)
}

async function envCheck(opts = {}) {
  const env = opts.env || process.env
  const targetNetwork = opts.network || 'mainnet'
  const net = NETWORKS[targetNetwork]

  if (!net) {
    console.error(`Unknown network: ${targetNetwork}. Use "mainnet" or "testnet".`)
    process.exit(1)
  }

  console.log(`\n🔍 baseskills env-check — target network: ${targetNetwork}\n`)

  // 1. PAYMASTER_URL network match
  const paymasterUrl = env.PAYMASTER_URL || ''
  if (!paymasterUrl) {
    check('PAYMASTER_URL', false, 'not set')
  } else if (!net.paymasterUrlPattern.test(paymasterUrl)) {
    check('PAYMASTER_URL', false,
      `URL contains wrong network segment. Expected pattern: ${net.paymasterUrlPattern}. Got: ${paymasterUrl}`)
  } else {
    console.log(`  ✅ PAYMASTER_URL matches ${targetNetwork}`)
  }

  // 2. Contract address exists and has bytecode
  const contractAddress = env.NEXT_PUBLIC_MARKET_ADDRESS || env.MARKET_ADDRESS || ''
  if (!contractAddress) {
    check('MARKET_ADDRESS', false, 'not set (NEXT_PUBLIC_MARKET_ADDRESS or MARKET_ADDRESS)')
  } else {
    // Verify bytecode on correct RPC
    try {
      const resp = await fetch(net.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_getCode',
          params: [contractAddress, 'latest'],
        }),
      })
      const data = await resp.json()
      const code = data.result || '0x'
      if (code === '0x' || code === '0x0') {
        check('MARKET_ADDRESS', false,
          `No bytecode at ${contractAddress} on ${targetNetwork}. Wrong address or wrong network.`)
      } else {
        console.log(`  ✅ Contract ${contractAddress} has bytecode on ${targetNetwork} (${Math.floor((code.length - 2) / 2)} bytes)`)
      }
    } catch (e) {
      warn('MARKET_ADDRESS', `Could not verify bytecode: ${e.message}`)
    }
  }

  // 3. PAYMASTER_API_KEY set
  if (!env.PAYMASTER_API_KEY) {
    warn('PAYMASTER_API_KEY', 'not set — paymaster proxy will fail auth')
  } else {
    console.log(`  ✅ PAYMASTER_API_KEY is set`)
  }

  // 4. Network consistency check — warn if USDC address in code doesn't match expected
  const usdcInEnv = env.NEXT_PUBLIC_USDC_ADDRESS || ''
  if (usdcInEnv && usdcInEnv.toLowerCase() !== net.usdcAddress.toLowerCase()) {
    check('USDC_ADDRESS', false,
      `USDC address ${usdcInEnv} does not match ${targetNetwork} USDC ${net.usdcAddress}`)
  } else if (!usdcInEnv) {
    warn('USDC_ADDRESS', `NEXT_PUBLIC_USDC_ADDRESS not set — verify hardcoded USDC matches ${targetNetwork}`)
  } else {
    console.log(`  ✅ USDC_ADDRESS matches ${targetNetwork}`)
  }

  // Report
  console.log()
  if (WARNINGS.length) {
    WARNINGS.forEach(w => console.log(`  ⚠️  ${w}`))
    console.log()
  }

  if (BLOCKERS.length) {
    console.log('❌ ENV CHECK FAILED — SUBMIT BLOCKER\n')
    BLOCKERS.forEach(b => console.log(`  🔴 ${b}`))
    console.log('\nFix all blockers before deploying.\n')
    process.exit(1)
  }

  console.log(`✅ ENV CHECK PASSED — ${targetNetwork} config looks consistent.\n`)
}

module.exports = { envCheck }

// CLI entrypoint
if (require.main === module) {
  const network = process.argv[2] || 'mainnet'
  envCheck({ network }).catch(e => {
    console.error(e)
    process.exit(1)
  })
}
