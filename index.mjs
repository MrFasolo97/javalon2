import { encrypt as _encrypt, decrypt as _decrypt } from 'eccrypto'
import { sign } from "@noble/secp256k1";
import randomBytes from 'randombytes';
import pkg from 'secp256k1';
const { publicKeyCreate, privateKeyVerify, ecdsaSign, ecdsaVerify } = pkg;
import pkg2 from 'bs58';
const { encode, decode } = pkg2;
const fromSeed = import('bip32').fromSeed;
import GrowInt from 'growint'
import fetch from 'node-fetch'
import { generateMnemonic as _generateMnemonic, mnemonicToSeedSync } from 'bip39'
import { sha256 } from 'js-sha256';

function generateEphemeralPrivate() {
  for (let i = 0; i < 10; i++) {
    const priv = crypto.randomBytes(32);
    try {
      const e = crypto.createECDH('secp256k1');
      e.setPrivateKey(priv); // will throw if invalid
      return priv;
    } catch (err) {
      // try again
    }
  }
  throw new Error('Failed to generate valid ephemeral private key');
}

let avalon = {
    config: {
        api: ['https://api.avalonblocks.com'],
        bwGrowth: 10000000,
        vtGrowth: 360000000,
        dmcaUrl: 'https://dmca.dtube.fso.ovh/v/',
        dmcaFeedUrl: 'https://dmca.dtube.fso.ovh/feed',
        dmcaAuthors: [],
        dmcaContents: [],
        dmcaAllowedContents: [],
    },
    init: (config) => {
        avalon.config = Object.assign(avalon.config,config)
    },
    getBlockchainHeight: (cb) => {
        avalon.get('/count',cb)
    },
    getBlock: (number, cb) => {
        avalon.get('/block/'+number,cb)
    },
    getAccount: (name, cb) => {
        avalon.get('/account/'+name,cb)
    },
    getAccountHistory: (name, lastBlock, cb) => {
        avalon.get('/history/'+name+'/'+lastBlock,cb)
    },
    getVotesByAccount: (name, lastTs, cb) => {
        avalon.get('/votes/all/'+name+'/'+lastTs,cb)
    },
    getPendingVotesByAccount: (name, lastTs, cb) => {
        avalon.get('/votes/pending/'+name+'/'+lastTs,cb)
    },
    getClaimableVotesByAccount: (name, lastTs, cb) => {
        avalon.get('/votes/claimable/'+name+'/'+lastTs,cb)
    },
    getClaimedVotesByAccount: (name, lastTs, cb) => {
        avalon.get('/votes/claimed/'+name+'/'+lastTs,cb)
    },
    getAccounts: (names, cb) => {
        avalon.get('/accounts/'+names.join(','),cb)
    },
    getContent: (name, link, cb) => {
        avalon.get('/content/'+name+'/'+link,cb)
    },
    getFollowing: (name, cb) => {
        avalon.get('/follows/'+name,cb)
    },
    getFollowers: (name, cb) => {
        avalon.get('/followers/'+name,cb)
    },
    getPendingRewards: (name, cb) => {
        avalon.get('/rewards/pending/'+name,cb)
    },
    getClaimedRewards: (name, cb) => {
        avalon.get('/rewards/claimed/'+name,cb)
    },
    getClaimableRewards: (name, cb) => {
        avalon.get('/rewards/claimable/'+name,cb)
    },
    generateCommentTree: (root, author, link) => {
        var replies = []
        var content = null
        if (author === root.author && link === root.link)
            content = root
        else
            content = root.comments[author+'/'+link]

        if (!content || !content.child || !root.comments) return []
        for (var i = 0; i < content.child.length; i++) {
            var comment = root.comments[content.child[i][0]+'/'+content.child[i][1]]
            comment.replies = avalon.generateCommentTree(root, comment.author, comment.link)
            comment.ups = 0
            comment.downs = 0
            if (comment.votes)
                for (let i = 0; i < comment.votes.length; i++) {
                    if (comment.votes[i].vt > 0)
                        comment.ups += comment.votes[i].vt
                    if (comment.votes[i].vt < 0)
                        comment.downs -= comment.votes[i].vt
                }

            comment.totals = comment.ups - comment.downs
            replies.push(comment)
        }
        replies = replies.sort(function(a,b) {
            return b.totals-a.totals
        })
        return replies
    },
    getDiscussionsByAuthor: (username, author, link, cb) => {
        if (!author && !link)
            avalon.get('/blog/'+username,cb)
        else
            avalon.get('/blog/'+username+'/'+author+'/'+link,cb)
    },
    getNewDiscussions: (author, link, cb) => {
        if (!author && !link)
            avalon.get('/new',cb)
        else
            avalon.get('/new/'+author+'/'+link,cb)
    },
    getP2PVideos: (author, link, cb) => {
        if (!author && !link)
            avalon.get('/p2p',cb)
        else
            avalon.get('/p2p/'+author+'/'+link,cb)
    },
    getHotDiscussions: (author, link, cb) => {
        if (!author && !link)
            avalon.get('/hot',cb)
        else
            avalon.get('/hot/'+author+'/'+link,cb)
    },
    getTrendingDiscussions: (author, link, cb) => {
        if (!author && !link) 
            avalon.get('/trending',cb)
        else
            avalon.get('/trending/'+author+'/'+link,cb)
    },
    getFeedDiscussions: (username, author, link, cb) => {
        if (!author && !link)
            avalon.get('/feed/'+username,cb)
        else
            avalon.get('/feed/'+username+'/'+author+'/'+link,cb)
    },
    getNotifications: (username, cb) => {
        avalon.get('/notifications/'+username,cb)
    },
    getSchedule: (cb) => {
        avalon.get('/schedule',cb)
    },
    getSupply: (cb) => {
        avalon.get('/supply',cb)
    },
    getLeaders: (cb) => {
        avalon.get('/allminers',cb)
    },
    getRewardPool: (cb) => {
        avalon.get('/rewardpool',cb)
    },
    getRewards: (name, cb) => {
        avalon.get('/distributed/'+name,cb)
    },
    get: (method,cb) => {
        fetch(avalon.randomNode()+method, {
            method: 'get',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            }
        }).then((res) => res.json()).then((res) => {
            if (method.startsWith("/trending") || method.startsWith("/hot") || method.startsWith("/new") || method.startsWith("/feed")) {
                fetch(avalon.config.dmcaFeedUrl, {
                    method: "POST",
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(res),
                }).then((newFeed) => {
                    newFeed.json().then((value) => cb(null, value))
                }).catch((err) => {
                    console.log(err)
                    cb(err)
                })
            } else {
                cb(null, res)
            }
        }).catch(function(error) {
            cb(error)
        })
    },
    keypair: () => {
        let priv, pub
        do {
            priv = Buffer.from(randomBytes(32).buffer)
            pub = publicKeyCreate(priv)
        } while (!privateKeyVerify(priv))

        return {
            pub: encode(pub),
            priv: encode(priv)
        }
    },
    generateMnemonic: () => {
        return _generateMnemonic()
    },
    mnemonicToKeyPair: (mnemonic) => {
        const seed = mnemonicToSeedSync(mnemonic)
        const bip32key = fromSeed(seed)
        return {
            pub: encode(bip32key.publicKey),
            priv: encode(bip32key.privateKey)
        }
    },
    privToPub: (priv) => {
        return encode(
            publicKeyCreate(
                decode(priv)))
    },
    sign: (privKey, sender, tx) => {
        if (typeof tx !== 'object')
            try {
                tx = JSON.parse(tx)
            } catch(e) {
                console.log('invalid transaction')
                return
            }


        tx.sender = sender
        // add timestamp to seed the hash (avoid transactions reuse)
        tx.ts = new Date().getTime()
        // hash the transaction
        tx.hash = sha256(JSON.stringify(tx));
        tx.signature = encode(sign(Buffer.from(tx.hash, 'hex'), decode(privKey)).signature);
        return tx
    },
    signData: (privKey, pubKey, data, ts, username = null) => {
        // sign off-chain data
        const r = { data: data }
        if (username !== null)
            r.username = username
        // add timestamp to seed the hash (avoid hash reuse)
        r.ts = ts
        // hash the data
        r.hash = sha256(JSON.stringify(r));
        // sign the data
        r.signature = encode(ecdsaSign(Buffer.from(r.hash, 'hex'), decode(privKey)).signature);
        r.pubKey = pubKey
        return r;
    },
    signMultisig: (privKeys = [], sender, tx) => {
        if (typeof tx !== 'object')
            try {
                tx = JSON.parse(tx)
            } catch(e) {
                console.log('invalid transaction')
                return
            }

        if (!tx.sender)
            tx.sender = sender
        if (!tx.ts)
            tx.ts = new Date().getTime()
        if (!tx.hash)
            tx.hash = createHash("SHA256", JSON.stringify(tx)).toString()
        if (!tx.signature || !Array.isArray(tx.signature))
            tx.signature = []
        
        for (let k in privKeys) {
            let sign = ecdsaSign(Buffer.from(tx.hash, 'hex'), decode(privKeys[k]))
            tx.signature.push([encode(sign.signature),sign.recid])
        }
        return tx
    },
    signVerify: (data, username = undefined, maxAge = 60000) => {
        // Verify for off-chain signature of data
        // signed in the last minute (or maxAge in milliseconds), if a username is supplied
        // check also for pubkey ownership on-chain
        if (typeof data === 'undefined') {
            console.log('invalid data')
            return false
        }
        let pubKey = data.pubKey
        if (typeof username !== 'undefined') {
            const prom = new Promise((resolve, reject) => avalon.getAccount(username, (err, account) => {
                const ts = Date.now()
                if (typeof account !== 'undefined')
                    for (const i in account.keys) {
                        if (pubKey === account.keys[i].pub) {
                            if (ts - maxAge < data.ts) {
                                if (crypto.createHash("SHA256").update(JSON.stringify(data.data)).digest() !== data.hash) {
                                    console.log('Hash mismatch!')
                                    reject(false)
                                }
                                if (ecdsaVerify(decode(data.signature), Buffer.from(data.hash, 'hex'), decode(pubKey))) return resolve(true)
                                reject(false)
                            }
                            reject(false)
                        } if (i === account.keys.length)
                            reject(false)
                    }
                else
                    reject(err)
            }))
            return prom
        }
        return ecdsaVerify(decode(data.signature), Buffer.from(data.hash, 'hex'), decode(pubKey))
    },
    sendTransaction: (tx, cb) => {
        // sends a transaction to a node
        // waits for the transaction to be included in a block
        // 200 with head block number if confirmed
        // 408 if timeout
        // 500 with error if transaction is invalid
        fetch(avalon.randomNode()+'/transact', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tx)
        }).then(function(res) {
            if (res.status === 500 || res.status === 408) 
                res.json().then(function(err) {
                    cb(err)
                })
            else if (res.status === 404)
                cb({error: 'Avalon API is down'})
            else 
                res.text().then(function(headBlock) {
                    cb(null, parseInt(headBlock))
                })
        })
    },
    sendRawTransaction: (tx, cb) => {
        // sends the transaction to a node
        // 200 with head block number if transaction is valid and node added it to mempool
        // 500 with error if transaction is invalid
        fetch(avalon.randomNode()+'/transact', {
            method: 'post',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tx)
        }).then(function(res) {
            if (res.status === 500)
                res.json().then(function(err) {
                    cb(err)
                })
            else
                res.text().then(function(headBlock) {
                    cb(null, parseInt(headBlock))
                })
        })
    },
    sendTransactionDeprecated: (tx, cb) => {
        // old and bad way of checking if a transaction is confirmed in a block
        avalon.sendRawTransaction(tx, function(error, headBlock) {
            if (error) 
                cb(error)
            else 
                setTimeout(function() {
                    avalon.verifyTransaction(tx, headBlock, 5, function(error, block) {
                        if (error) console.log(error)
                        else cb(null, block)
                    })
                }, 1500)
        })
    },
    verifyTransaction: (tx, headBlock, retries, cb) => {
        var nextBlock = headBlock+1
        fetch(avalon.randomNode()+'/block/'+nextBlock, {
            method: 'get',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json'
            }
        }).then(res => res.text()).then(function(text) {
            try {
                var block = JSON.parse(text)
            } catch (error) {
                // block is not yet available, retrying in 1.5 secs
                if (retries <= 0) return
                retries--
                setTimeout(function(){avalon.verifyTransaction(tx, headBlock, retries, cb)}, 1500)
                return
            }

            var isConfirmed = false
            for (let i = 0; i < block.txs.length; i++)
                if (block.txs[i].hash === tx.hash) {
                    isConfirmed = true
                    break
                }


            if (isConfirmed)
                cb(null, block)
            else if (retries > 0) {
                retries--
                setTimeout(function(){avalon.verifyTransaction(tx, nextBlock, retries, cb)},3000)
            } else
                cb('Failed to find transaction up to block #'+nextBlock)

        })
    },
    encrypt(pub, message, ephemPriv, cb) {
        try {
            // support calling encrypt(pub, message, cb)
            if (typeof cb !== 'function') {
            cb = ephemPriv;
            ephemPriv = null;
            }

            const pubBuf = Buffer.isBuffer(pub) ? pub : decode(pub);

            // ephemPriv may be Base58 string or Buffer; if omitted generate one
            let ephemPrivBuf;
            if (ephemPriv) {
            ephemPrivBuf = Buffer.isBuffer(ephemPriv) ? ephemPriv : decode(ephemPriv);
            } else {
            ephemPrivBuf = generateEphemeralPrivate();
            }

            // Setup ECDH with ephemeral private key
            const ecdh = crypto.createECDH('secp256k1');
            ecdh.setPrivateKey(ephemPrivBuf);

            // Compute shared secret
            let shared = ecdh.computeSecret(pubBuf); // Buffer
            // some libraries return 65-byte uncompressed; normalize by stripping leading 0x04
            if (shared.length === 65 && shared[0] === 0x04) shared = shared.slice(1);

            // KDF: SHA-512 -> AES key (first 32), MAC key (last 32)
            const hash = crypto.createHash('sha512').update(shared).digest();
            const aesKey = hash.slice(0, 32);
            const macKey = hash.slice(32);

            // AES-256-CBC with random IV
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
            const ciphertext = Buffer.concat([cipher.update(Buffer.from(message)), cipher.final()]);

            // Get compressed ephemeral public key (33 bytes)
            const ephemPub = ecdh.getPublicKey(undefined, 'compressed');

            // MAC over (iv || ephemPub || ciphertext)
            const dataToMac = Buffer.concat([iv, ephemPub, ciphertext]);
            const mac = crypto.createHmac('sha256', macKey).update(dataToMac).digest();

            // Encode each part in Base58 and join with '_'
            const parts = [
            encode(iv),
            encode(ephemPub),
            encode(ciphertext),
            encode(mac)
            ];
            const output = parts.join('_');
            cb(null, output);
        } catch (err) {
            cb(err);
        }
    },
    decrypt(priv, encryptedStr, cb) {
        try {
            const privBuf = Buffer.isBuffer(priv) ? priv : decode(priv);

            const parts = encryptedStr.split('_');
            if (parts.length !== 4) return cb(new Error('Malformed encrypted payload'));

            const iv = decode(parts[0]);
            const ephemPub = decode(parts[1]);
            const ciphertext = decode(parts[2]);
            const mac = decode(parts[3]);

            // ECDH using recipient private key
            const ecdh = crypto.createECDH('secp256k1');
            ecdh.setPrivateKey(privBuf);

            let shared = ecdh.computeSecret(ephemPub);
            if (shared.length === 65 && shared[0] === 0x04) shared = shared.slice(1);

            const hash = crypto.createHash('sha512').update(shared).digest();
            const aesKey = hash.slice(0, 32);
            const macKey = hash.slice(32);

            // Verify MAC
            const dataToMac = Buffer.concat([iv, ephemPub, ciphertext]);
            const expectedMac = crypto.createHmac('sha256', macKey).update(dataToMac).digest();
            if (!crypto.timingSafeEqual(expectedMac, mac)) {
            return cb(new Error('MAC mismatch - data corrupted or wrong key'));
            }

            // Decrypt AES-256-CBC
            const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

            cb(null, plaintext.toString());
        } catch (err) {
            cb(err);
        }
    },
    randomNode: () => {
        var nodes = avalon.config.api
        if (typeof nodes === 'string') return nodes
        else return nodes[Math.floor(Math.random()*nodes.length)]
    },
    availableBalance: (account) => {
        if (!account.voteLock)
            return account.balance
        let newLock = 0
        for (let v in account.proposalVotes)
            if (account.proposalVotes[v].end > new Date().getTime() && account.proposalVotes[v].amount - account.proposalVotes[v].bonus > newLock)
                newLock = account.proposalVotes[v].amount - account.proposalVotes[v].bonus
        return account.balance - newLock
    },
    votingPower: (account) => {
        return new GrowInt(account.vt, {
            growth:account.balance/(avalon.config.vtGrowth),
            max: account.maxVt
        }).grow(new Date().getTime()).v
    },
    bandwidth: (account) => {
        return new GrowInt(account.bw, {growth: Math.max(account.baseBwGrowth || 0,account.balance)/(avalon.config.bwGrowth), max:256000})
            .grow(new Date().getTime()).v
    },
    TransactionType: {
        NEW_ACCOUNT: 0,
        APPROVE_NODE_OWNER: 1,
        DISAPROVE_NODE_OWNER: 2,
        TRANSFER: 3,
        COMMENT: 4,
        VOTE: 5,
        USER_JSON: 6,
        FOLLOW: 7,
        UNFOLLOW: 8,
        // RESHARE: 9, // not sure
        NEW_KEY: 10,
        REMOVE_KEY: 11,
        CHANGE_PASSWORD: 12,
        PROMOTED_COMMENT: 13,
        TRANSFER_VT: 14,
        TRANSFER_BW: 15,
        LIMIT_VT: 16,
        CLAIM_REWARD: 17,
        ENABLE_NODE: 18,
        TIPPED_VOTE: 19,
        NEW_WEIGHTED_KEY: 20,
        SET_SIG_THRESHOLD: 21,
        SET_PASSWORD_WEIGHT: 22,
        UNSET_SIG_THRESHOLD: 23,
        NEW_ACCOUNT_WITH_BW: 24,
        PLAYLIST_JSON: 25,
        PLAYLIST_PUSH: 26,
        PLAYLIST_POP: 27,
        COMMENT_EDIT: 28,
        ACCOUNT_AUTHORIZE: 29,
        ACCOUNT_REVOKE: 30,
        FUND_REQUEST_CREATE: 31,
        FUND_REQUEST_CONTRIB: 32,
        FUND_REQUEST_WORK: 33,
        FUND_REQUEST_WORK_REVIEW: 34,
        PROPOSAL_VOTE: 35,
        PROPOSAL_EDIT: 36,
        CHAIN_UPDATE_CREATE: 37,
        MD_QUEUE: 38,
        MD_SIGN: 39
    }
}

if (typeof window != 'undefined') window.javalon = avalon
export default avalon
