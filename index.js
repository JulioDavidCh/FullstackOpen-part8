const { ApolloServer, gql } = require('apollo-server')
let { authors, books } = require('./temporalDatabase')
const uuid = require('uuid/v1')

const typeDefs = gql`
  type Book {
    title: String!
    published: Int!
    author: String!
    genres: [String]
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
      genres: [String]
    ): Book
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
    bookCount: () => books.length,
    authorCount: () => authors.length,
    allBooks: (root, args) => {
      let deliveredBooks = books
      if(args.author){
        deliveredBooks = books.filter(book => book.author === args.author)
      }
      if(args.genre){
        deliveredBooks = deliveredBooks.filter(
          book => book.genres.indexOf(args.genre) > -1
        )
      }
      return deliveredBooks
    }
    ,
    allAuthors: () => authors
  },
  Author: {
    name: (root) => root.name,
    id: (root) => root.id,
    born: (root) => root.born,
    bookCount: (root) => books.filter(book => book.author === root.name).length,
  },
  Mutation: {
    addBook: (root, args) => {
      const authorExists = authors.find(author => author.name === args.author)
      if(!authorExists){
        const newAuthor = { name: args.author, id: uuid() }
        authors = authors.concat(newAuthor)
      }
      const newBook = { ...args, id: uuid() }
      books = books.concat(newBook)
      return newBook
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