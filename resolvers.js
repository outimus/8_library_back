const { UserInputError, AuthenticationError } = require('apollo-server')
const jwt = require('jsonwebtoken')
const { PubSub } = require('graphql-subscriptions')
const pubsub = new PubSub()

const Author = require('./models/author')
const Book = require('./models/book')
const User = require('./models/user')

/*const { v1: uuid } = require('uuid')
const { off } = require('./models/author')*/
const JWT_SECRET = 'NEED_HERE_A_SECRET_KEY'

const resolvers = {
    Query: {
      bookCount: async () => Book.collection.countDocuments(),
      authorCount: async () => Author.collection.countDocuments(),
      allBooks: async (root, args) => {
        let books = await Book.find({})
  
        if (!args.genre && !args.author) { //Ei filttereitä
          return books
        }
        if (args.genre && !args.author) { //Genre -filtteri
          books = books.filter((a) => a.genres.includes(args.genre.toLowerCase()))
          console.log(books)
          return books
        }
        if (!args.genre && args.author) { //Author -filtteri
          const author = await Author.findOne({ name: args.author })
          books = await Book.find({ author: author._id })
          return books
        }
        if (args.genre && args.author) { //Author ja Genre -filtterit
          const author = await Author.findOne({ name: args.author })
          const booksByAuthor = await Book.find({ author: author._id })
          books = booksByAuthor.filter((a) => a.genres.includes(args.genre.toLowerCase()))
          return books
        }
      },
      allAuthors: async (root, args) => {
        return Author.find({})
      },
      allGenres: async (root, args) => {
        const books = await Book.find({})
        let allGenres = []
        books.map(b => {
          if (b.genres.length > 0) {
            b.genres.map(b => {
              if (!allGenres.includes(b)) {
                allGenres.push(b)
              }
            })
          }
        })
        return allGenres
      },
      me: (root, args, context) => {
        return context.currentUser
      }
    },
    Author: {
      name: async (root) => {
        const author = await Author.findOne({ _id: root })
        return author.name
      },
      born: async (root) => {
        const author = await Author.findOne({ _id: root })
        return author.born
      },
      bookCount: async (root) => {
        const books = await Book.find({ author: root._id })
        return books.length
      }
    },
    Mutation: {
      //vain kirjautuneelle
      addBook: async (root, args, context) => {
        const currentUser = context.currentUser
        if (!currentUser) {
          throw new AuthenticationError("not authenticated")
        }
        let author = await Author.findOne({ name: args.author })
        if (!author){
          author = new Author({ 
            name: args.author,
            born: null
           })
           try {
            await author.save()
           } catch (error) {
            throw new UserInputError(error.message, {
              invalidArgs: args,
            })
           }
        }
        const book = new Book({
          title: args.title,
          published: args.published,
          author: author._id,
          genres: args.genres
        })
        try {
          await book.save()
        } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })  
        }

        pubsub.publish('BOOK_ADDED', { bookAdded: book })

        return book
      },
      //vain kirjautuneelle
      editAuthor: async (root, args, context) => {
        const currentUser = context.currentUser
        if (!currentUser) {
          throw new AuthenticationError("not authenticated")
        }
  
        const author = await Author.findOne({ name: args.name })
        author.born = args.setBornTo
        try {
          author.save()
        } catch (error) {
          throw new UserInputError(error.message, {
            invalidArgs: args
          })
        }
        return author
      },
      createUser: async (root, args) => {
        const user = new User({ username: args.username })
  
        return user.save()
        .catch(error => {
          throw new UserInputError(error.message, {
            invalidArgs: args,
          })
        })
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })
        if ( !user || args.password !== 'secret' ) {
          throw new UserInputError("wrong credentials")
        }
        const userForToken = {
          username: user.username,
          id: user._id,
        }
  
        return { value: jwt.sign(userForToken, JWT_SECRET) }
      },
    },
    Subscription: {
      bookAdded: {
          subscribe: () => pubsub.asyncIterator('BOOK_ADDED')
          },
        },
      }

module.exports = resolvers