const { ApolloServer, gql, UserInputError, PubSub } = require('apollo-server')
const { MONGODB_URI } = require('./utils/config')
const mongoose = require('mongoose')
const Authors = require('./models/authorModel')
const Books = require('./models/bookModel')
const Users = require('./models/userModel')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'
const pubsub = new PubSub()

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
  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

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
    createUser(
      username: String!
      password: String!
      favoriteGenre: String
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
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
      let populatedBooks = await Books.find({}).populate('author', {name: true})
      //kind of ugly the way we mapped populatedBooks after populated
      //there should be a better solution
      let deliveredBooks = populatedBooks.map(book => {
        book._doc.author = book._doc.author.name
        return book._doc
      })

      if(args.genre){
        deliveredBooks = deliveredBooks.filter(
          book => book.genres.indexOf(args.genre) > -1
        )
      }
      return deliveredBooks
    },
    allAuthors: async () => {
      const authorsDb = await Authors.find({})
      return authorsDb
    },
    me: (root, args, context) => {
      return context.currentUser
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
    addBook: async (root, args, context) => {
      const loggedUser = context.currentUser
      ? await Users.find({username: context.currentUser.username})
      : null

      if(!loggedUser){
        throw new UserInputError('Bad authorizacion token')
      }

      let authorInDb = await Authors.findOne({ name: args.author })
      if(!authorInDb){
        authorInDb = new Authors({ name: args.author })
        try{
          await authorInDb.save()
        }catch(exception){
          throw new UserInputError(exception.message, {
            invalidArgs: args.author
          })
        }
      }
      const newBook = new Books({ ...args, author: authorInDb._id })

      try{
        await newBook.save()
      }catch(exception){
        throw new UserInputError(exception.message, {
          invalidArgs: args.title
        })
      }

      return newBook
    },
    editAuthor: async (root, args, context) => {
      const loggedUser = context.currentUser
      ? await Users.find({username: context.currentUser.username})
      : null

      if(!loggedUser){
        throw new UserInputError('Bad authorizacion token')
      }

      let userToEdit = await Authors.findOneAndUpdate(
        {name: args.name},
        {born: args.setToBorn},
        {new: true}
      )
      if(!userToEdit) return null
      return userToEdit
    },
    createUser: async (root, args) => {
      const saltedRounds = 10
      const passwordHash = await bcrypt.hash(args.password, saltedRounds)
      const newUser = new Users({
        username: args.username,
        passwordHash,
        favoriteGenre: args.favoriteGenre
      })

      await newUser.save()

      return newUser.toJSON()
    },
    login: async (root, args) => {
      const foundUser = await Users.findOne({username: args.username})
      const correctPassword = foundUser
      ? await bcrypt.compare(args.password, foundUser.passwordHash)
      : false

      if(correctPassword){
        const userForToken = {
          username: foundUser.username,
          id: foundUser._id
        }
  
        return {
          value: jwt.sign(userForToken, JWT_SECRET)
        }
      }
      return null
    }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await (await Users.findById(decodedToken.id)).toJSON()
      return { currentUser }
    }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})