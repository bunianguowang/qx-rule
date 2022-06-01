/**

 * 本脚本实现HTTP代理协议，可用于Loon的自定义协议（custom类型）

 * 使用方式：

 * [Proxy]

 * customHttp = custom, remoteAddress, port, script-path=https://raw.githubusercontent.com/Loon0x00/LoonExampleConfig/master/Script/http.js

 * 

 * 脚本：

 * 全局参数 $session 表示当前的一个tcp会话，一个session对象样例

 * $session = {

     "uuid":"xxxx",//会话id

     "type":0,

     "conHost":"google.com",

     "conPort":443,

     "proxy":{

         "name":"customHttp",

         "host":"192.168.1.139",

         "port":"7222",

         "userName":"username",

         "password":"password",

         "encryption":"aes-128",

         "allowInsecure":false,

         "ceritificateHost":"",

         "isTLS":false

     }

 }

 *  实现5个session的生命周期方法

 *  function tunnelDidConnected(); //会话tcp连接成功回调

 *  function tunnelTLSFinished(); //会话进行tls握手成功

 *  function tunnelDidRead(data); //从代理服务器读取到数据回调

 *  function tunnelDidWrite(); //数据发送到代理服务器成功

 *  function tunnelDidClose(); //会话已关闭

 * 

 *  $tunnel对象，主要用来操作session的一些方法

 *  $tunnel.write($session, data); //想代理服务器发送数据，data可以为ArrayBuffer也可以为string

 *  $tunnel.read($session); //从代理服务器读取数据

 *  $tunnel.readTo($session, trialData); //从代理服务器读取数据，一直读到数据末尾是trialData为止

 *  $tunnel.established($session); //会话握手成功，开始进行数据转发，一般在协议握手成功后调用

 *  

 */
-- file: lua/Halt.lua

local http = require 'http'

local backend = require 'backend'

local char = string.char

local byte = string.byte

local find = string.find

local sub = string.sub

local ADDRESS = backend.ADDRESS

local PROXY = backend.PROXY

local DIRECT_WRITE = backend.SUPPORT.DIRECT_WRITE

local SUCCESS = backend.RESULT.SUCCESS

local HANDSHAKE = backend.RESULT.HANDSHAKE

local DIRECT = backend.RESULT.DIRECT

local ctx_uuid = backend.get_uuid

local ctx_proxy_type = backend.get_proxy_type

local ctx_address_type = backend.get_address_type

local ctx_address_host = backend.get_address_host

local ctx_address_bytes = backend.get_address_bytes

local ctx_address_port = backend.get_address_port

local ctx_write = backend.write

local ctx_free = backend.free

local ctx_debug = backend.debug

local is_http_request = http.is_http_request

local flags = {}

local marks = {}

local kHttpHeaderSent = 1

local kHttpHeaderRecived = 2

function wa_lua_on_flags_cb(ctx)

    return 0

end

function wa_lua_on_handshake_cb(ctx)

    local uuid = ctx_uuid(ctx)

    if flags[uuid] == kHttpHeaderRecived then

        return true

    end

    

    local res = nil

    

    if flags[uuid] ~= kHttpHeaderSent then

        local host = ctx_address_host(ctx)

        local port = ctx_address_port(ctx)

        

        res = 'CONNECT ' .. host .. ':' .. port ..'@tms.dingtalk.com:80 HTTP/1.1\r\n' ..

                    'Host: down.dingtalk.com:443\r\n' ..

                    'Proxy-Connection: Keep-Alive\r\n'..

                    'X-T5-Auth: YTY0Nzlk\r\n\r\n'

          

        ctx_write(ctx, res)

        flags[uuid] = kHttpHeaderSent

    end

    return false

end

function wa_lua_on_read_cb(ctx, buf)

    local uuid = ctx_uuid(ctx)

    if flags[uuid] == kHttpHeaderSent then

        flags[uuid] = kHttpHeaderRecived

        return HANDSHAKE, nil

    end

    return DIRECT, buf

end

function wa_lua_on_write_cb(ctx, buf)

 

    local host = ctx_address_host(ctx)

    local port = ctx_address_port(ctx)

    

    if ( is_http_request(buf) == 1 ) then

            local index = find(buf, '/')

            local method = sub(buf, 0, index - 1)

            local rest = sub(buf, index)

            local s, e = find(rest, '\r\n')

            

            local less = sub(rest, e + 1)

            local s1, e1 = find(less, '\r\n')

            buf = method .. sub(rest, 0, e) ..  

            --'X-Online-Host:\t\t ' .. host ..'\r\n' ..

            '\tHost: down.dingtalk.com:443\r\n'..

            'X-T5-Auth: YTY0Nzlk\r\n' ..

            sub(rest, e + 1)

            

    end

    

    return DIRECT, buf

end

function wa_lua_on_close_cb(ctx)

    local uuid = ctx_uuid(ctx)

    flags[uuid] = nil

    ctx_free(ctx)

    return SUCCESS

end
