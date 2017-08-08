const fs = require('fs-extra')
const _ = require('lodash')
const jsonfile = require('jsonfile')
const glob = require('glob')

var mappingsPath = process.env.MAPPINGS

var copyOptions = { preserveTimestamps: true }

if(process.env.COPY_OVERWRITE == true)
  copyOptions.overwrite = true
if(process.env.COPY_ERROR_ON_EXISTS == true)
  copyOptions.errorOnExist = true

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
          mode = 'symlink'
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
          
          // should we handle here, in each case, or after? depends on what sideeffects we want to avoid
          filesHandled.push(file)
          
          switch(mode) {
            case 'copy':
              fs.copy(file, destination, copyOptions)
                .then(() => console.log('File \'' + file + '\' successfully copied to \'' + destination + '\'.'))
                .catch(err => console.error(err))
              break;
            case 'symlink':
                if(!file.startsWith('/'))
                  file = './' + file
                
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
                  if(err.errno == -17)
                    console.error('Error: Symlink \'' + destination + '\' already exists.')
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