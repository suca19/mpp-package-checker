// Well-known packages that attackers like to imitate (typosquatting).
// Hand-picked from the most-downloaded npm and PyPI packages. Not exhaustive.

export const POPULAR_NPM = [
  'react', 'react-dom', 'lodash', 'express', 'axios', 'chalk', 'commander', 'debug', 'moment',
  'request', 'async', 'underscore', 'uuid', 'yargs', 'dotenv', 'typescript', 'webpack', 'babel-core',
  'eslint', 'prettier', 'jest', 'mocha', 'next', 'vue', 'angular', 'jquery', 'bluebird', 'colors',
  'glob', 'minimist', 'semver', 'mkdirp', 'rimraf', 'fs-extra', 'body-parser', 'cors', 'jsonwebtoken',
  'bcrypt', 'bcryptjs', 'mongoose', 'mongodb', 'mysql', 'mysql2', 'pg', 'redis', 'ioredis', 'socket.io',
  'nodemon', 'ws', 'cheerio', 'puppeteer', 'electron', 'rxjs', 'tslib', 'core-js', 'classnames',
  'prop-types', 'styled-components', 'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'vite',
  'esbuild', 'rollup', 'zod', 'dayjs', 'date-fns', 'node-fetch', 'cross-env', 'inquirer', 'ora',
  'nanoid', 'qs', 'cookie-parser', 'multer', 'passport', 'helmet', 'morgan', 'winston', 'pino',
  'sequelize', 'prisma', 'graphql', 'apollo-server', 'redux', 'react-redux', 'react-router',
  'react-router-dom', 'immer', 'zustand', 'svelte', 'hono', 'fastify', 'koa', 'openai',
  '@anthropic-ai/sdk', 'stripe', 'twilio', 'aws-sdk', 'firebase', 'discord.js', 'ethers', 'web3',
  'crypto-js', 'node-sass', 'cross-spawn', 'coffee-script', 'event-stream', 'ua-parser-js',
]

export const POPULAR_PYPI = [
  'requests', 'numpy', 'pandas', 'urllib3', 'boto3', 'botocore', 'setuptools', 'six', 'certifi',
  'idna', 'charset-normalizer', 'python-dateutil', 'pyyaml', 'typing-extensions', 'packaging',
  'pip', 'wheel', 'cryptography', 'jinja2', 'markupsafe', 'attrs', 'click', 'pydantic', 'flask',
  'django', 'fastapi', 'uvicorn', 'sqlalchemy', 'psycopg2', 'pymysql', 'redis', 'celery',
  'scipy', 'matplotlib', 'seaborn', 'scikit-learn', 'tensorflow', 'torch', 'keras', 'transformers',
  'pillow', 'opencv-python', 'beautifulsoup4', 'lxml', 'selenium', 'scrapy', 'pytest', 'tox',
  'black', 'flake8', 'mypy', 'pylint', 'colorama', 'tqdm', 'rich', 'httpx', 'aiohttp', 'openai',
  'anthropic', 'langchain', 'tiktoken', 'jsonschema', 'pyjwt', 'paramiko', 'docker', 'kubernetes',
  'python-dotenv', 'pytz', 'tzdata', 'protobuf', 'grpcio', 'websockets', 'stripe', 'twilio',
  'bs4', 'discord.py', 'web3', 'pycryptodome', 'pyopenssl', 'termcolor', 'pygame', 'jupyter',
  'notebook', 'ipython', 'streamlit', 'gradio', 'huggingface-hub', 'datasets', 'nltk', 'spacy',
]
