const fs = require('fs-extra')
const _ = require('lodash')
const jsonfile = require('jsonfile')
const glob = require('glob')
const exec = require('child_process').exec
const async = require('async')

const octal = /^([0-7]){3}$/
const symbolic = /^(?:[ugoa][+\-=]r?w?x?,?){1,3}$/

const mappingsPath = process.env.MAPPINGS

let globalCopyOptions = { preserveTimestamps: true }

globalCopyOptions.overwrite = Boolean(process.env.COPY_OVERWRITE) // default: false
globalCopyOptions.errorOnExist = Boolean(process.env.COPY_ERROR_ON_EXISTS) // default: false

let defaultMode = process.env.DEFAULT_MODE
if(defaultMode === undefined)
  defaultMode = 'copy'

let filesHandled = []

function wrapConfigPath(path) {
  if(!path.toString().endsWith('/'))
    return path.toString() + '/'
}

jsonfile.readFile(mappingsPath, (err, obj) => {
  if(err)
    throw err
  
  const mappings = obj 
  
  if(_.isEmpty(mappings))
    throw new Error('Mappings file empty!')
  
  console.log('Mappings loaded.')
  
  for(x in mappings) {
    let input = mappings[x]
    
    for(y in input) {
      glob(y, { cwd: x }, (er, files) => {
        let mapping = input[y]
        
        let mode
        if(_.has(mapping, 'mode') && (mapping.mode === 'copy' || mapping.mode === 'symlink')) {
          mode = mapping.mode
        }else {
          mode = defaultMode
        }
        
        let accessMode
        if(_.has(mapping, 'accessMode'))
        	accessMode = parseAccessMode(mapping.accessMode) // for now, access mode is only applied on copy operations, in order to preserve the permissions of the original file
        
        let copyOptions = Object.assign({}, globalCopyOptions) // override
        if(_.has(mapping, 'flags')) {
          if(_.has(mapping.flags, 'copyOverwrite'))
            copyOptions.overwrite = Boolean(flags.copyOverwrite)
          
          if(_.has(mapping.flags, 'errorOnExists'))
            copyOptions.errorOnExist = Boolean(flags.errorOnExists)
        }
        
        files.filter((file) => !filesHandled.includes(file)).forEach((file) => {
          let destination = mapping.destination
        
          if(_.has(mapping, 'rename')) {
            // TODO: Implement
          }
          
          // substitution
          if(destination.includes('@')) {
            for(var k = 0; k < destination.length; k++) {
              if(destination[k] === '@') {
                if(destination[k-1] === '\\') {
                  destination = destination.slice(0, k-1) + destination.slice(k)
                }else {
                  destination = destination.slice(0, k) + file + destination.slice(k+1)
                }
              }
            }
          }
          
          path = wrapConfigPath(x)
          
          if(!file.startsWith('/'))
            file = path + file
          
          // should we handle here, in each case, or after? depends on what side-effects we want to avoid
          filesHandled.push(file)
          
          switch(mode) {
            case 'copy':
              fs.copy(file, destination, copyOptions)
                .then(() => console.log('File \'' + file + '\' successfully copied to \'' + destination + '\'.'))
                .then(() => if(accessMode) )
                .catch(err => console.error(err))
              
              async.series([
                callback => {
                  fs.copy(file, destination, copyOptions)
                    .then(() => console.log('File \'' + file + '\' successfully copied to \'' + destination + '\'.'))
                    .then(() => callback(null, null))
                    .catch(err => callback(err, null))
                },
                callback => {
                  if(accessMode) {
                    exec('chmod ' + accessMode + ' ' + file, { cwd: '/' }, (error, stdout, stderr) => {
                      console.log('Permissions for copied file \'' + file + '\' have been updated to \'' + accessMode + '\'.')
                      callback(err, null)
                    })
                  }else callback(null, null)
                }
              ],
              (err, results) => if(err) console.error(err))
              
              break;
            case 'symlink':
                Promise.resolve({
                  then: (resolve, reject) => {
                    fs.symlink(file, destination, 'file', (err) => {
                      if(err) reject(err)
                      else resolve()
                    })
                  }
                })
                .then(() => {
                  console.log('File \'' + file + '\' successfully symlinked to \'' + destination + '\'.')
                })
                .catch(err => {
                  /*if(err.errno == -17)
                    console.error('Error: Symlink \'' + destination + '\' already exists.')*/
                  
                  if(err.errno != -17)
                    console.error('Error: ' + err)
                })
              break;
            default:
              break;
          }
        })
      })
    }
  }
})

function parseAccessMode(str) {
	str = String(str)
  
	if(octal.test(str)) return str
  if(symbolic.test(str)) return str
  
  return null
}