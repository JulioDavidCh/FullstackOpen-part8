const { ApolloServer, gql } = require('apollo-server')
const { MONGODB_URI } = require('./utils/config')
let { authors, books } = require('./temporalDatabase') // <- delete soon
const mongoose = require('mongoose')
const Authors = require('./models/authorModel')
const Books = require('./models/bookModel')
const jwt = require('jsonwebtoken')

const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'

mongoose.set('useFindAndModify', false)

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI, { useNewUrlParser: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: String!
    genres: [String!]!
    id: ID!
  }

  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ): Book
    editAuthor(
      name: String!
      setToBorn: Int!
    ): Author
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
  }
`

const resolvers = {
  Query: {
    bookCount: async () => {
      const booksDb = await Books.find({})
      return booksDb.length
    },
    authorCount: async () => {
      const authorsDb = await Authors.find({})
      return authorsDb.length
    },
    allBooks: async (root, args) => {
      let deliveredBooks = await Books.find({})
      if(args.genre){
        deliveredBooks = deliveredBooks.filter(
          book => book.genres.indexOf(args.genre) > -1
        )
      }
      return deliveredBooks
    }
    ,
    allAuthors: async () => {
      const authorsDb = await Authors.find({})
      return authorsDb
    }
  },
  Author: {
    name: (root) => root.name,
    id: (root) => root.id,
    born: (root) => root.born,
    bookCount: async (root) => {
      const authorsBooks = await Books.find({author: root.id})
      return authorsBooks.length
    },
  },
  Mutation: {
    addBook: async (root, args) => {
      let authorInDb = await Authors.findOne({ name: args.author })
      if(!authorInDb){
        authorInDb = new Authors({ name: args.author })
        await authorInDb.save()
      }
      const newBook = new Books({ ...args, author: authorInDb._id })
      await newBook.save()

      return newBook
    },
    editAuthor: async (root, args) => {
      let userToEdit = await Authors.findOneAndUpdate(
        {name: args.name},
        {born: args.setToBorn},
        {new: true}
      )
      if(!userToEdit) return null
      return userToEdit
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})