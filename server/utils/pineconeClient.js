const { Pinecone } = require('@pinecone-database/pinecone');

let _client = null;

const getPineconeIndex = () => {
  if (!_client) {
    _client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  console.log('[Pinecone] Index name:', process.env.PINECONE_INDEX);
  console.log('[Pinecone] Host:', process.env.PINECONE_HOST);
  return _client.index(process.env.PINECONE_INDEX, process.env.PINECONE_HOST);
};

module.exports = { getPineconeIndex };
