const fs = require('fs-extra')
const _ = require('lodash')
const jsonfile = require('jsonfile')
const glob = require('glob')

var mappingsPath = process.env.MAPPINGS

var configPath = process.env.CONFIG_DIR
if(configPath === undefined)
  configPath = "/config/"
else if(!configPath.toString().endsWith('/'))
  configPath = configPath.toString() + '/'

var globalCopyOptions = { preserveTimestamps: true }

globalCopyOptions.overwrite = Boolean(process.env.COPY_OVERWRITE) // default: false
globalCopyOptions.errorOnExist = Boolean(process.env.COPY_ERROR_ON_EXISTS) // default: false

var defaultMode = process.env.DEFAULT_MODE
if(defaultMode === undefined)
  defaultMode = 'copy'

var filesHandled = []

jsonfile.readFile(mappingsPath, (err, obj) => {
  if(err)
    throw err
  
  var mappings = obj 
  
  if(_.isEmpty(mappings))
    throw new Error('Mappings file empty!')
  
  console.log('Mappings loaded.')
  
  for(x in mappings) {
    var input = mappings[x]
    
    for(y in input) {
      glob(y, { cwd: x }, (er, files) => {
        var mapping = input[y]
        
        var mode
        if(_.has(mapping, 'mode') && (mapping.mode === 'copy' || mapping.mode === 'symlink')) {
          mode = mapping.mode
        }else {
          mode = defaultMode
        }
        
        let copyOptions = Object.assign({}, globalCopyOptions) // override
        if(_.has(mapping, 'flags')) {
          if(_.has(mapping.flags, 'copyOverwrite'))
            copyOptions.overwrite = Boolean(flags.copyOverwrite)
          
          if(_.has(mapping.flags, 'errorOnExists'))
            copyOptions.errorOnExist = Boolean(flags.errorOnExists)
        }
        
        files.filter((file) => !filesHandled.includes(file)).forEach((file) => {
          var destination = mapping.destination
        
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
          
          if(!file.startsWith('/'))
            file = configPath + file
          
          // should we handle here, in each case, or after? depends on what side-effects we want to avoid
          filesHandled.push(file)
          
          switch(mode) {
            case 'copy':
              fs.copy(file, destination, copyOptions)
                .then(() => console.log('File \'' + file + '\' successfully copied to \'' + destination + '\'.'))
                .catch(err => console.error(err))
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