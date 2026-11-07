/* app.js — lógica de UI del prototipo (extraída de index.html en F1; F2: sesión, inventario y clientes; F3: emisión 01/03; F4: transacciones, NC, anular, reintentar y bitácora contra api.*).
   Script clásico: todas las funciones son globales porque el HTML usa onclick inline.
   PDF_DATA vive en js/pdf-data.js. */
  var titles = {
    'v-venta':'Nueva venta','v-inventario':'Inventario','v-clientes':'Clientes','v-historial':'Transacciones','v-borradores':'Borradores',
    'g-dash':'Panel de ventas','g-ventas':'Ventas','g-reportes':'Reportes',
    'a-usuarios':'Administración','a-contingencia':'Contingencia','a-bitacora':'Bitácora de auditoría','a-config':'Configuración'
  };
  var titleEl = {vendedor:'v-title',gerente:'g-title',admin:'a-title'};

  function show(id){
    document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
    document.getElementById(id).classList.add('active');
    window.scrollTo(0,0);
  }
  function enter(role){
    // F2: gerente y admin son pantallas solo de ADMIN (la API solo tiene ADMIN y VENDEDOR)
    if(role!=='vendedor' && !esAdmin()){ toast('Tu rol no tiene acceso a esa sección','warn'); return; }
    show('app-'+role); closeSidebars();
    if(role!=='vendedor') contarContingencia();
  }

  /* ===== Sesión (F2) ===== */
  var usuarioActual = null;
  function esAdmin(){ return !!usuarioActual && usuarioActual.rol==='ADMIN'; }
  function alertaError(e){ toast((e && (e.mensaje||e.message)) || 'Error inesperado','warn'); }
  function _h(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function iniciales(nombre){
    return (nombre||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0].toUpperCase()}).join('');
  }

  function doLogin(){
    var u = document.getElementById('login-user').value.trim();
    var pw = document.getElementById('login-pass').value;
    if(!u || !pw){ toast('Ingresa usuario y contraseña','warn'); return; }
    var btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Ingresando...';
    api.login(u, pw).then(function(d){
      document.getElementById('login-pass').value = '';
      iniciarSesion(d.usuario);
      toast('Bienvenido, '+d.usuario.nombre);
    }).catch(alertaError).then(function(){ btn.disabled = false; btn.textContent = 'Ingresar'; });
  }

  function iniciarSesion(usuario){
    usuarioActual = usuario;
    document.body.classList.toggle('rol-admin', esAdmin());
    var av = document.getElementById('v-avatar');
    if(av){ av.textContent = iniciales(usuario.nombre); av.title = usuario.nombre+' ('+usuario.rol+')'; }
    limpiarFormProducto();
    show('app-vendedor'); setPanelById('vendedor','v-venta'); closeSidebars();
    cargarProductos(); buscarClientes(); cargarClientesVenta(); contarContingencia(); cargarCatalogos();
    ['v-simular','h-simular','ct-simular'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value='ok'; });
  }

  function cerrarSesionLocal(){
    usuarioActual = null;
    document.body.classList.remove('rol-admin');
    inventory = []; cart = []; clientes = []; clientesVenta = []; ventaClienteId = null; catalogosMh = null;
    closeDteResult(); closeAnular(); closeNotaCredito();
    dtes = []; bitacora = []; ctPendientes = []; ctEventos = []; ctProg = null; ctConsultas = null; actualizarColaContingencia(0); renderHistorial(); renderBitacora(); renderContingencia();
    var ctm = document.getElementById('ct-motivo'); if(ctm) ctm.value = '';
    renderInventory(); renderCatalog(''); renderCart(); renderClientes(); renderClientForm();
    show('login'); closeSidebars();
  }
  function logout(){ api.logout(); cerrarSesionLocal(); }

  // Token vencido o inválido (api.js ya limpió la sesión)
  document.addEventListener('api:no-autenticado', function(){
    if(!usuarioActual) return;
    cerrarSesionLocal();
    toast('Tu sesión expiró. Inicia sesión de nuevo','warn');
  });

  function setPanel(role, btn){
    var panel = btn.getAttribute('data-panel');
    var nav = btn.parentElement;
    nav.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    swapPanel(role, panel);
    closeSidebars();
  }
  function setPanelById(role, panelId){
    var sb = document.getElementById('sb-'+role);
    sb.querySelectorAll('.side-nav button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-panel')===panelId);
    });
    swapPanel(role, panelId);
  }
  function swapPanel(role, panelId){
    var app = document.getElementById('app-'+role);
    app.querySelectorAll('.panel').forEach(function(p){p.style.display='none'});
    document.getElementById(panelId).style.display='block';
    var t = document.getElementById(titleEl[role]);
    if(t && titles[panelId]) t.textContent = titles[panelId];
    window.scrollTo(0,0);
    // F4: paneles que se recargan desde la API al abrirse
    if(usuarioActual && panelId==='v-historial') cargarHistorial();
    if(usuarioActual && panelId==='a-bitacora') cargarBitacora();
    if(usuarioActual && panelId==='a-contingencia') cargarContingencia();
  }

  /* ===== Inventario + catálogo + carrito (en memoria) ===== */
  var inventory = [];        // productos activos de GET /api/productos (catálogo de venta)
  var inventarioVista = [];  // resultado de la búsqueda en el panel Inventario
  var productoEditando = null;
  var cart = [];
  var selectedDte = '01';          // '01' | '03' (F3)

  function ymd(d){ var m=d.getMonth()+1, day=d.getDate(); return d.getFullYear()+'-'+(m<10?'0'+m:m)+'-'+(day<10?'0'+day:day); }
  function money(n){ return '$' + n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  /* ===== Inventario contra la API (F2) ===== */
  function cargarProductos(){
    return api.productos.listar().then(function(lista){
      inventory = lista;
      // quita del carrito lo que ya no existe o quedó inactivo
      cart = cart.filter(function(c){ return inventory.some(function(p){return p.id===c.id}); });
      renderCatalog(''); renderCart();
      return buscarInventario();
    }).catch(alertaError);
  }

  var _invTimer;
  function buscarInventario(){
    clearTimeout(_invTimer);
    return new Promise(function(resolve){
      _invTimer = setTimeout(function(){
        var q = (document.getElementById('inv-search')||{}).value || '';
        api.productos.listar({q:q.trim()}).then(function(lista){
          inventarioVista = lista; renderInventory();
        }).catch(alertaError).then(resolve);
      }, 250);
    });
  }

  function renderInventory(){
    var tb = document.getElementById('inv-tbody');
    if(!tb) return;
    if(inventarioVista.length===0){
      tb.innerHTML = '<tr><td colspan="5"><div class="empty" style="padding:22px">Sin productos</div></td></tr>';
    } else {
      tb.innerHTML = inventarioVista.map(function(p){
        return '<tr><td>'+_h(p.codigo)+'</td>'+
          '<td class="prod-name">'+_h(p.descripcion)+'</td>'+
          '<td class="num">'+money(p.precio)+'</td>'+
          '<td class="num">'+p.stock+'</td>'+
          '<td class="num"><div class="row-actions">'+
            '<button class="icon-btn" title="Agregar a venta" onclick="addToCartFromInv('+p.id+')">🛒</button>'+
            '<button class="icon-btn solo-admin" title="Editar" onclick="editarProducto('+p.id+')">✏️</button>'+
            '<button class="icon-btn del solo-admin" title="Desactivar" onclick="removeProduct('+p.id+')">🗑️</button>'+
          '</div></td></tr>';
      }).join('');
    }
    document.getElementById('inv-count').textContent = inventarioVista.length + ' productos';
  }

  function editarProducto(id){
    var p = inventarioVista.filter(function(x){return x.id===id})[0];
    if(!p) return;
    productoEditando = p;
    document.getElementById('inv-codigo').value = p.codigo;
    document.getElementById('inv-name').value = p.descripcion;
    document.getElementById('inv-price').value = p.precio;
    document.getElementById('inv-stock').value = p.stock;
    document.getElementById('inv-form-title').textContent = 'Editar producto '+p.codigo;
    document.getElementById('inv-save').textContent = 'Guardar cambios';
    document.getElementById('inv-cancel').style.display = '';
    document.getElementById('inv-codigo').focus();
  }

  function limpiarFormProducto(){
    productoEditando = null;
    ['inv-codigo','inv-name','inv-price','inv-stock'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    var t=document.getElementById('inv-form-title'); if(t) t.textContent='Agregar producto';
    var b=document.getElementById('inv-save'); if(b) b.textContent='+ Agregar al catálogo';
    var c=document.getElementById('inv-cancel'); if(c) c.style.display='none';
  }

  function guardarProducto(){
    var codigo = document.getElementById('inv-codigo').value.trim();
    var descripcion = document.getElementById('inv-name').value.trim();
    var precioTxt = document.getElementById('inv-price').value;
    var stockTxt = document.getElementById('inv-stock').value;
    if(!codigo){ toast('Ingresa el código del producto','warn'); return; }
    if(!descripcion){ toast('Ingresa la descripción del producto','warn'); return; }
    var datos = { codigo:codigo, descripcion:descripcion, precio:parseFloat(precioTxt), stock: stockTxt===''?0:parseInt(stockTxt,10) };
    if(isNaN(datos.precio)){ toast('Ingresa un precio válido','warn'); return; }
    var editando = productoEditando;
    var btn = document.getElementById('inv-save'); btn.disabled = true;
    var op = editando ? api.productos.actualizar(editando.id, datos) : api.productos.crear(Object.assign({unidad:59}, datos));
    op.then(function(p){
      toast(editando ? 'Producto '+p.codigo+' actualizado' : '"'+p.descripcion+'" agregado al catálogo');
      limpiarFormProducto();
      return cargarProductos();
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }

  // Borrado lógico (PUT activo:false), solo ADMIN
  function removeProduct(id){
    var p = inventarioVista.filter(function(x){return x.id===id})[0];
    if(!p || !confirm('¿Desactivar "'+p.descripcion+'"? Ya no aparecerá en el catálogo.')) return;
    api.productos.actualizar(id, {activo:false}).then(function(){
      toast('Producto desactivado');
      if(productoEditando && productoEditando.id===id) limpiarFormProducto();
      return cargarProductos();
    }).catch(alertaError);
  }

  /* ===== Clientes contra la API (F2) ===== */
  var clientes = [];
  var _cliTimer;
  function buscarClientes(){
    clearTimeout(_cliTimer);
    _cliTimer = setTimeout(function(){
      var q = (document.getElementById('cli-search')||{}).value || '';
      var tipo = (document.getElementById('cli-filtro-tipo')||{}).value || '';
      api.clientes.listar({q:q.trim(), tipo:tipo}).then(function(lista){
        clientes = lista; renderClientes();
      }).catch(alertaError);
    }, 250);
  }

  /* ===== P2: catálogos MH (departamento → municipio → distrito, tipo de documento) ===== */
  var catalogosMh = null;   // respuesta de GET /api/catalogos
  function cargarCatalogos(){
    if(catalogosMh) return Promise.resolve(catalogosMh);
    return api.catalogos().then(function(c){ catalogosMh = c; llenarSelectsCliente(); return c; }).catch(alertaError);
  }
  function _opts(lista, vacio){
    return '<option value="">'+vacio+'</option>' + lista.map(function(x){
      return '<option value="'+_h(x.codigo)+'">'+_h(x.nombre)+'</option>';
    }).join('');
  }
  function _depto(cod){ return (catalogosMh ? catalogosMh.departamentos : []).filter(function(d){ return d.codigo===cod; })[0] || null; }
  function _municipio(dep, cod){ return dep ? dep.municipios.filter(function(m){ return m.codigo===cod; })[0] || null : null; }
  function llenarSelectsCliente(){
    if(!catalogosMh) return;
    document.getElementById('cli-tipodoc').innerHTML = _opts(catalogosMh.tiposDocumento, 'Sin documento');
    document.getElementById('cli-depto').innerHTML = _opts(catalogosMh.departamentos, 'Selecciona un departamento');
    cambiarDepartamento();
    toggleNumDocumento();
  }
  function cambiarDepartamento(){
    var dep = _depto(document.getElementById('cli-depto').value);
    var sm = document.getElementById('cli-municipio');
    sm.innerHTML = _opts(dep ? dep.municipios : [], dep ? 'Selecciona un municipio' : '—');
    sm.disabled = !dep;
    cambiarMunicipio();
  }
  function cambiarMunicipio(){
    var dep = _depto(document.getElementById('cli-depto').value);
    var mun = _municipio(dep, document.getElementById('cli-municipio').value);
    var sd = document.getElementById('cli-distrito');
    sd.innerHTML = _opts(mun ? mun.distritos : [], mun ? 'Selecciona un distrito' : '—');
    sd.disabled = !mun;
  }
  function toggleNumDocumento(){
    var tipo = document.getElementById('cli-tipodoc').value;
    var inp = document.getElementById('cli-numdoc');
    inp.disabled = !tipo;
    if(!tipo) inp.value = '';
    inp.placeholder = {'36':'NIT: 9 o 14 dígitos','13':'DUI: 01234567-8','03':'Número de pasaporte','02':'Número de carnet','37':'Número de documento'}[tipo] || '—';
  }
  /** "Distrito, Municipio, Departamento" a partir de los códigos (corto = sin departamento, para la tabla). */
  function textoUbicacion(dir, corto){
    if(!dir || !dir.departamento || typeof CATALOGOS_MH==='undefined') return dir && dir.complemento ? dir.complemento : '';
    var b = CATALOGOS_MH.buscar(dir.departamento, dir.municipio, dir.distrito);
    return [b.distrito && b.distrito.nombre, b.municipio && b.municipio.nombre, !corto && b.departamento && b.departamento.nombre].filter(Boolean).join(', ');
  }
  function textoDocumento(c){
    if(!c.tipoDocumento) return c.nit || '';
    var t = (catalogosMh ? catalogosMh.tiposDocumento : []).filter(function(x){ return x.codigo===c.tipoDocumento; })[0];
    return (t ? t.nombre : c.tipoDocumento)+' '+(c.numDocumento||'');
  }

  function renderClientes(){
    var tb = document.getElementById('cli-tbody');
    if(!tb) return;
    if(clientes.length===0){
      tb.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:22px">Sin clientes</div></td></tr>';
    } else {
      tb.innerHTML = clientes.map(function(c){
        return '<tr><td class="prod-name">'+_h(c.nombre)+(c.nombreComercial?'<div class="muted small">'+_h(c.nombreComercial)+'</div>':'')+'</td>'+
          '<td>'+(c.tipo==='CONTRIBUYENTE'?'Contribuyente':'Consumidor')+'</td>'+
          '<td>'+_h(textoDocumento(c)||'—')+'</td><td>'+_h(c.nrc||'—')+'</td>'+
          '<td>'+_h(textoUbicacion(c.direccion, true)||'—')+'</td><td>'+_h(c.correo||'—')+'</td></tr>';
      }).join('');
    }
    var n = document.getElementById('cli-count'); if(n) n.textContent = clientes.length + ' clientes';
  }

  function toggleCamposContribuyente(){
    var esContrib = document.getElementById('cli-tipo').value==='CONTRIBUYENTE';
    document.getElementById('cli-contribuyente').style.display = esContrib ? '' : 'none';
    document.getElementById('cli-consumidor-doc').style.display = esContrib ? 'none' : '';
    document.getElementById('cli-dir-req').style.display = esContrib ? '' : 'none';
  }

  function crearCliente(){
    function v(id){ return document.getElementById(id).value.trim(); }
    var tipo = v('cli-tipo');
    var datos = {
      tipo: tipo, nombre: v('cli-nombre'), nombreComercial: v('cli-comercial') || null,
      tipoDocumento: null, numDocumento: null,
      nit: null, nrc: null, codActividad: null, descActividad: null,
      telefono: v('cli-telefono') || null, correo: v('cli-correo') || null, direccion: null
    };
    if(!datos.nombre){ toast('Ingresa el nombre del cliente','warn'); return; }

    // Dirección: los tres códigos salen de los selects del catálogo MH
    var dir = { departamento: v('cli-depto'), municipio: v('cli-municipio'), distrito: v('cli-distrito'), complemento: v('cli-complemento') };
    var algo = dir.departamento || dir.municipio || dir.distrito || dir.complemento;
    if(algo || tipo==='CONTRIBUYENTE'){
      if(!dir.departamento || !dir.municipio || !dir.distrito || !dir.complemento){
        toast('Completa la dirección: departamento, municipio, distrito y complemento','warn'); return;
      }
      datos.direccion = dir;
    }

    if(tipo==='CONTRIBUYENTE'){
      datos.nit = v('cli-nit') || null; datos.nrc = v('cli-nrc') || null;
      datos.codActividad = v('cli-codact') || null; datos.descActividad = v('cli-descact') || null;
      // el detalle de formato (dígitos, longitudes, catálogos) lo valida la API
      if(!datos.nit || !datos.nrc || !datos.codActividad || !datos.descActividad){
        toast('Un contribuyente requiere NIT, NRC y actividad económica','warn'); return;
      }
    } else if(v('cli-tipodoc')){
      datos.tipoDocumento = v('cli-tipodoc'); datos.numDocumento = v('cli-numdoc') || null;
      if(!datos.numDocumento){ toast('Ingresa el número de documento','warn'); return; }
    }
    var btn = document.getElementById('cli-save'); btn.disabled = true;
    api.clientes.crear(datos).then(function(c){
      toast('Cliente "'+c.nombre+'" guardado');
      ['cli-nombre','cli-comercial','cli-numdoc','cli-nit','cli-nrc','cli-codact','cli-descact','cli-telefono','cli-correo','cli-complemento']
        .forEach(function(id){ document.getElementById(id).value=''; });
      llenarSelectsCliente();
      buscarClientes(); cargarClientesVenta();
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }

  /* catálogo dropdown */
  function renderCatalog(filter){
    var dd = document.getElementById('v-catalog');
    if(!dd) return;
    var f = (filter||'').toLowerCase();
    var list = inventory.filter(function(p){return (p.codigo+' '+p.descripcion).toLowerCase().indexOf(f)!==-1});
    if(list.length===0){ dd.innerHTML = '<div class="dd-empty">Sin coincidencias</div>'; return; }
    dd.innerHTML = list.map(function(p){
      return '<div class="dd-item" onclick="addToCart('+p.id+')"><span>'+_h(p.descripcion)+'</span><span class="price">'+money(p.precio)+'</span></div>';
    }).join('');
  }
  function openCatalog(){ renderCatalog(document.getElementById('v-prod-search').value); document.getElementById('v-catalog').classList.add('open'); }
  function closeCatalog(){ var dd=document.getElementById('v-catalog'); if(dd) dd.classList.remove('open'); }
  function toggleCatalog(){ var dd=document.getElementById('v-catalog'); if(dd.classList.contains('open')) closeCatalog(); else openCatalog(); }
  function filterCatalog(v){ renderCatalog(v); document.getElementById('v-catalog').classList.add('open'); }

  /* ===== Nueva venta: carrito + emisión 01/03 contra la API (F3) ===== */
  var selectedPay = 'Tarjeta';     // ambos métodos son contado → condicionOperacion 1
  var clientesVenta = [];          // todos los clientes activos (selector de receptor)
  var ventaClienteId = null;       // null = consumidor final sin receptor (solo 01)
  var ultimaEmision = null;        // { emision, detalle } para el modal de resultado

  function _cent(n){ return Math.round(n*100); }
  function r2(n){ return Math.round((n + (n>=0?1:-1)*1e-9) * 100) / 100; }
  /** Precio unitario según el tipo: 01 con IVA (en centavos, como el backend: 2.50 → 2.83), 03 sin IVA */
  function precioVenta(p){ return selectedDte==='01' ? Math.round(_cent(p.precio)*113/100)/100 : p.precio; }
  function prodPorId(id){ return inventory.filter(function(x){return x.id===id})[0]; }

  /* carrito */
  function addToCart(id){
    var p = prodPorId(id); if(!p) return;
    var item = cart.filter(function(c){return c.id===id})[0];
    var qty = item ? item.qty+1 : 1;
    if(qty > p.stock){ toast('Stock insuficiente: quedan '+p.stock+' de '+p.codigo,'warn'); closeCatalog(); return; }
    if(item) item.qty = qty; else cart.push({id:id, qty:1});
    renderCart(); closeCatalog();
    var s=document.getElementById('v-prod-search'); if(s) s.value='';
  }
  function addToCartFromInv(id){ addToCart(id); setPanelById('vendedor','v-venta'); toast('Producto agregado a la venta'); }
  function changeQty(id,d){
    var item = cart.filter(function(c){return c.id===id})[0];
    if(!item) return;
    var p = prodPorId(id);
    if(d>0 && p && item.qty+d > p.stock){ toast('Stock insuficiente: quedan '+p.stock,'warn'); return; }
    item.qty += d;
    if(item.qty<=0) cart = cart.filter(function(c){return c.id!==id});
    renderCart();
  }
  function removeFromCart(id){ cart = cart.filter(function(c){return c.id!==id}); renderCart(); }

  /** Total estimado (el definitivo lo calcula la API) */
  function calcularTotales(){
    var gravada = 0;
    cart.forEach(function(c){ var p=prodPorId(c.id); if(p) gravada += _cent(precioVenta(p))*c.qty; });
    gravada = gravada/100;
    if(selectedDte==='01') return { subtotal:gravada, iva:r2(gravada/1.13*0.13), total:gravada };
    var iva = r2(gravada*0.13);
    return { subtotal:gravada, iva:iva, total:r2(gravada+iva) };
  }

  function renderCart(){
    var tb = document.getElementById('v-cart');
    if(!tb) return;
    if(cart.length===0){
      tb.innerHTML = '<tr><td colspan="5"><div class="empty" style="padding:26px"><div class="ic">🧺</div>Agrega productos desde el catálogo</div></td></tr>';
    } else {
      tb.innerHTML = cart.map(function(c){
        var p = prodPorId(c.id);
        if(!p) return '';
        var pu = precioVenta(p);
        return '<tr><td class="prod-name">'+_h(p.descripcion)+'</td>'+
          '<td class="num"><div class="qty"><button onclick="changeQty('+c.id+',-1)">−</button><span>'+c.qty+'</span><button onclick="changeQty('+c.id+',1)">+</button></div></td>'+
          '<td class="num">'+money(pu)+'</td>'+
          '<td class="num">'+money(_cent(pu)*c.qty/100)+'</td>'+
          '<td class="num"><button class="icon-btn del" onclick="removeFromCart('+c.id+')">✕</button></td></tr>';
      }).join('');
    }
    var t = calcularTotales();
    var es01 = selectedDte==='01';
    document.getElementById('v-pu-head').textContent = es01 ? 'P. unit. (con IVA)' : 'P. unit. (sin IVA)';
    document.getElementById('v-subtotal-label').textContent = es01 ? 'Total gravado (IVA incluido)' : 'Subtotal (sin IVA)';
    document.getElementById('v-iva-label').textContent = es01 ? 'IVA incluido (13%)' : 'IVA (13%)';
    document.getElementById('v-subtotal').textContent = money(t.subtotal);
    document.getElementById('v-iva').textContent = money(t.iva);
    document.getElementById('v-total').textContent = money(t.total);
  }

  /* tipo de DTE */
  function pickDte(tipo){
    selectedDte = tipo;
    document.getElementById('vt-01').classList.toggle('sel', tipo==='01');
    document.getElementById('vt-03').classList.toggle('sel', tipo==='03');
    // 03 solo admite CONTRIBUYENTE: descarta una selección que no lo sea
    var c = clientePorId(ventaClienteId);
    if(tipo==='03' && c && c.tipo!=='CONTRIBUYENTE') ventaClienteId = null;
    renderClientForm(); renderCart();
  }
  function pickPay(el){
    el.parentElement.querySelectorAll('.pay-opt').forEach(function(o){o.classList.remove('sel')});
    el.classList.add('sel');
    selectedPay = el.getAttribute('data-pay');
  }

  /* receptor */
  function clientePorId(id){ return clientesVenta.filter(function(c){return c.id===id})[0]; }
  function cargarClientesVenta(){
    return api.clientes.listar().then(function(lista){
      clientesVenta = lista;
      if(ventaClienteId && !clientePorId(ventaClienteId)) ventaClienteId = null;
      renderClientForm();
    }).catch(alertaError);
  }
  function pickCliente(v){ ventaClienteId = v ? parseInt(v,10) : null; renderClientForm(); }

  function renderClientForm(){
    var box = document.getElementById('v-client-form');
    if(!box) return;
    var es03 = selectedDte==='03';
    var lista = es03 ? clientesVenta.filter(function(c){return c.tipo==='CONTRIBUYENTE'}) : clientesVenta;
    var opts = (es03 ? '<option value="">Selecciona un contribuyente</option>' : '<option value="">Consumidor final (sin receptor)</option>') +
      lista.map(function(c){
        return '<option value="'+c.id+'"'+(c.id===ventaClienteId?' selected':'')+'>'+_h(c.nombre)+(c.nit?' · NIT '+_h(c.nit):'')+'</option>';
      }).join('');
    var html = '<div class="field"><label>'+(es03?'Contribuyente':'Cliente')+(es03?' <span class="req">*</span>':' (opcional)')+'</label>'+
      '<select id="v-cliente" onchange="pickCliente(this.value)">'+opts+'</select></div>';
    var c = clientePorId(ventaClienteId);
    if(c){
      html += '<div class="cli-resumen">'+
        (textoDocumento(c)?'<div><span>Documento</span>'+_h(textoDocumento(c))+'</div>':'')+
        (c.nrc?'<div><span>NRC</span>'+_h(c.nrc)+'</div>':'')+
        (c.descActividad?'<div><span>Actividad</span>'+_h(c.codActividad+' · '+c.descActividad)+'</div>':'')+
        (c.telefono?'<div><span>Teléfono</span>'+_h(c.telefono)+'</div>':'')+
        (c.correo?'<div><span>Correo</span>'+_h(c.correo)+'</div>':'')+
        (c.direccion?'<div><span>Dirección</span>'+_h([c.direccion.complemento, textoUbicacion(c.direccion)].filter(Boolean).join(', '))+'</div>':'')+
      '</div>';
    }
    html += '<p class="muted small" style="margin:-6px 0 14px">¿No está en la lista? <a href="#" class="link" onclick="setPanelById(\'vendedor\',\'v-clientes\');return false">Crear cliente</a></p>';
    box.innerHTML = html;
  }

  /* emisión */
  function confirmSale(){
    if(cart.length===0){ toast('Agrega al menos un producto a la venta','warn'); return; }
    if(selectedDte==='03' && !ventaClienteId){ toast('Un CCF (03) requiere elegir un cliente CONTRIBUYENTE','warn'); return; }
    var payload = {
      clienteId: ventaClienteId,
      condicionOperacion: 1,
      items: cart.map(function(c){ return { productoId:c.id, cantidad:c.qty, descuento:0 }; })
    };
    var sim = document.getElementById('v-simular');
    var simular = (esAdmin() && sim && sim.value!=='ok') ? sim.value : undefined;
    var btn = document.getElementById('v-confirmar');
    btn.disabled = true; btn.textContent = 'Emitiendo DTE '+selectedDte+'...';
    api.dte.emitir(selectedDte, payload, simular).then(function(emision){
      // limpiar la venta y refrescar stock
      cart = []; ventaClienteId = null; renderClientForm(); renderCart();
      cargarProductos();
      // el detalle trae jsonDte (totalLetras); si falla, se muestra lo que hay
      return api.dte.obtener(emision.id).then(function(det){ return {emision:emision, detalle:det}; },
                                             function(){ return {emision:emision, detalle:null}; });
    }).then(function(r){
      mostrarResultadoDte(r.emision, r.detalle);
    }).catch(alertaError).then(function(){ btn.disabled = false; btn.textContent = '✓ Confirmar venta'; });
  }

  var ESTADO_UI = {
    PROCESADO:   { cls:'ok',   txt:'PROCESADO',   msg:'Recibido y sellado por MH' },
    RECHAZADO:   { cls:'err',  txt:'RECHAZADO',   msg:'MH rechazó el documento (no se descontó stock)' },
    CONTINGENCIA:{ cls:'warn', txt:'CONTINGENCIA',msg:'MH no respondió; emitido en contingencia (pendiente del evento de contingencia o de reintento)' },
    INVALIDADO:  { cls:'err',  txt:'INVALIDADO',  msg:'Documento invalidado' }
  };

  function mostrarResultadoDte(e, det){
    ultimaEmision = { emision:e, detalle:det };
    var st = ESTADO_UI[e.estado] || { cls:'warn', txt:e.estado, msg:'' };
    var json = det && det.jsonDte;
    var letras = json && json.resumen ? json.resumen.totalLetras : '—';
    var obs = (e.respuestaMh && e.respuestaMh.observaciones) || [];
    var inv = det && det.invalidacion;
    document.getElementById('dr-title').textContent = (e.tipoDte==='03'?'Comprobante de Crédito Fiscal':e.tipoDte==='05'?'Nota de Crédito':'Factura')+' · DTE '+e.tipoDte;
    document.getElementById('dr-estado').innerHTML = '<span class="dr-badge dr-'+st.cls+'">'+st.txt+'</span>'+estadoBadge(e.estado)+'<span class="muted small">'+st.msg+'</span>';
    function fila(k, v, mono){ return '<div class="dr-row"><span>'+k+'</span><b'+(mono?' class="mono"':'')+'>'+v+'</b></div>'; }
    function link(d){ return '<a href="#" class="link" onclick="verDte('+d.id+');return false">'+_h(d.numeroControl)+'</a> '+estadoBadge(d.estado); }
    var extra = '';
    if(det){
      extra += fila('Receptor', det.cliente ? _h(det.cliente.nombre)+' <span class="muted">('+_h(det.cliente.tipo)+')</span>' : 'Consumidor final');
      if(det.usuario) extra += fila('Emitido por', _h(det.usuario));
      if(det.dteRelacionado) extra += fila('CCF relacionado', link(det.dteRelacionado));
      if(det.notasCredito && det.notasCredito.length)
        extra += fila('Notas de crédito', det.notasCredito.map(function(n){ return link(n)+' '+money(n.total); }).join('<br>'));
      if(det.eventoContingencia) extra += fila('Evento de contingencia',
        '<div style="display:flex;align-items:center;gap:8px"><a href="#" class="link mono-sm" onclick="verEventoContingencia('+det.eventoContingencia.id+');return false">'+
        _h(det.eventoContingencia.codigoGeneracion)+'</a>'+resultadoBadge(det.eventoContingencia.estado)+'</div>');
      if(det.consultaMh) extra += fila('Consultas a MH', det.consultaMh.consultas+' · '+_h(RESULTADO_CONSULTA[det.consultaMh.resultado]||det.consultaMh.resultado||'—')+
        ' <span class="muted">(última: '+fmtFechaHora(det.consultaMh.ultimaConsulta)+')</span>');
      if(inv) extra += fila('Invalidación', estadoBadge(inv.estado==='PROCESADO'?'INVALIDADO':'RECHAZADO')+' '+_h(inv.motivo||'')+
        (inv.selloRecibido?'<br><span class="mono">'+_h(inv.selloRecibido)+'</span>':' <span class="muted">(evento '+_h(inv.estado)+')</span>'));
    }
    document.getElementById('dr-datos').innerHTML =
      fila('Número de control', _h(e.numeroControl), true) +
      fila('Código de generación', _h(e.codigoGeneracion), true) +
      fila('Sello recibido', e.selloRecibido ? _h(e.selloRecibido) : '<span class="muted">— sin sello —</span>', true) +
      fila('Fecha de emisión', _h(String(e.fechaEmision||'').replace('T',' '))) +
      fila('Total', money(e.total)) +
      fila('Total en letras', _h(letras)) +
      (e.respuestaMh ? fila('Mensaje MH', _h(e.respuestaMh.codigoMsg+' · '+e.respuestaMh.descripcionMsg)) : '') +
      (obs.length ? fila('Observaciones', obs.map(_h).join('<br>')) : '') +
      extra;
    document.getElementById('dr-tab-json').textContent = 'JSON DTE';
    document.getElementById('dr-json').textContent = json ? JSON.stringify(json, null, 2) : '(No se pudo obtener el JSON del DTE)';
    var mh = { firmador:e.firmador, respuestaMh:e.respuestaMh };
    if(inv) mh.eventoInvalidacion = { jsonEvento:inv.jsonEvento, firmador:inv.firmador, respuestaMh:inv.respuestaMh };
    document.getElementById('dr-mh').textContent = JSON.stringify(mh, null, 2);
    document.getElementById('dr-acciones').innerHTML = accionesDte(e);
    drTab('json');
    document.getElementById('dte-result-modal').classList.add('show');
  }
  function drTab(t){
    document.getElementById('dr-tab-json').classList.toggle('active', t==='json');
    document.getElementById('dr-tab-mh').classList.toggle('active', t==='mh');
    document.getElementById('dr-json').style.display = t==='json' ? '' : 'none';
    document.getElementById('dr-mh').style.display = t==='mh' ? '' : 'none';
  }
  function closeDteResult(){ document.getElementById('dte-result-modal').classList.remove('show'); }
  function copiarDrActivo(){
    var pre = document.getElementById(document.getElementById('dr-json').style.display==='none' ? 'dr-mh' : 'dr-json');
    try { navigator.clipboard.writeText(pre.textContent).then(function(){ toast('JSON copiado'); }, function(){ toast('No se pudo copiar','warn'); }); }
    catch(x){ toast('No se pudo copiar','warn'); }
  }

  document.addEventListener('click', function(e){
    var combo = document.getElementById('v-combo');
    if(combo && !combo.contains(e.target)) closeCatalog();
  });

  /* ===== Transacciones / Mis ventas contra GET /api/dte (F4) ===== */
  var MAIL_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>';
  var ESTADO_BADGE = {
    PROCESADO:    { cls:'st-sealed',   txt:'Aceptado' },
    INVALIDADO:   { cls:'st-annulled', txt:'Anulado' },
    CONTINGENCIA: { cls:'st-pending',  txt:'Contingencia' },
    RECHAZADO:    { cls:'st-rejected', txt:'Rechazado' }
  };
  var TIPO_DTE = { '01':'Factura 01', '03':'CCF 03', '05':'Nota crédito 05' };
  function estadoBadge(e){
    var b = ESTADO_BADGE[e] || { cls:'', txt:e };
    return '<span class="st '+b.cls+'" title="'+_h(e)+'">'+b.txt+'</span>';
  }
  function fmtFechaHora(iso){
    if(!iso) return '—';
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    return m ? m[3]+'/'+m[2]+'/'+m[1]+' '+m[4]+':'+m[5] : String(iso);
  }
  /** X-Simular elegido por un ADMIN (en Nueva venta o en Transacciones); undefined = ok */
  function simularDe(selId){
    var el = document.getElementById(selId);
    return (esAdmin() && el && el.value!=='ok') ? el.value : undefined;
  }

  var dtes = [];
  function cargarHistorial(){
    var f = {
      tipo: document.getElementById('h-tipo').value,
      estado: document.getElementById('h-estado').value,
      desde: document.getElementById('h-desde').value,
      hasta: document.getElementById('h-hasta').value
    };
    if(f.desde && f.hasta && f.desde > f.hasta){ toast('"Desde" no puede ser mayor que "Hasta"','warn'); return Promise.resolve(); }
    return api.dte.listar(f).then(function(lista){ dtes = lista; renderHistorial(); }).catch(alertaError);
  }

  /** Botones según tipo y estado (fila y pie del modal) */
  function accionesDte(d){
    var b = [];
    if(d.tipoDte==='03' && d.estado==='PROCESADO') b.push('<button class="btn-mini" onclick="abrirNotaCredito('+d.id+')">Nota de crédito</button>');
    if(d.estado==='PROCESADO') b.push('<button class="btn-mini danger" onclick="abrirAnular('+d.id+')">Anular</button>');
    if(d.estado==='CONTINGENCIA') b.push('<button class="btn-mini" onclick="consultarMhDte('+d.id+')" title="¿MH sí lo recibió?">Consultar MH</button>');
    if(d.estado==='CONTINGENCIA') b.push('<button class="btn-mini" onclick="reintentarDte('+d.id+')">Reintentar envío</button>');
    return b.join('');
  }

  function renderHistorial(){
    var tb = document.getElementById('h-tbody');
    if(!tb) return;
    var q = document.getElementById('h-search').value.trim().toLowerCase();
    var rows = dtes.filter(function(d){
      return !q || (d.numeroControl+' '+d.codigoGeneracion+' '+(d.receptor||'')).toLowerCase().indexOf(q)!==-1;
    });
    if(rows.length===0){
      tb.innerHTML = '<tr><td colspan="7"><div class="empty" style="padding:26px"><div class="ic">🗂️</div>No hay documentos con estos filtros</div></td></tr>';
    } else {
      tb.innerHTML = rows.map(function(d){
        return '<tr><td>'+fmtFechaHora(d.fechaEmision)+'</td>'+
          '<td><a href="#" class="link mono-sm" onclick="verDte('+d.id+');return false" title="Ver detalle">'+_h(d.numeroControl)+'</a></td>'+
          '<td>'+(TIPO_DTE[d.tipoDte]||d.tipoDte)+'</td>'+
          '<td>'+_h(d.receptor||'Consumidor final')+'</td>'+
          '<td class="num">'+money(d.total)+'</td>'+
          '<td>'+estadoBadge(d.estado)+'</td>'+
          '<td class="num"><div class="row-actions">'+
            '<button class="btn-mini" onclick="verDte('+d.id+')">Ver</button>'+
            accionesDte(d)+
            '<button class="icon-btn" title="Enviar por correo" onclick="openEmailModal(\''+_h(d.numeroControl)+'\','+d.id+')">'+MAIL_SVG.replace('margin-right:5px','')+'</button>'+
          '</div></td></tr>';
      }).join('');
    }
    document.getElementById('h-count').textContent = rows.length+' '+(rows.length===1?'documento':'documentos');
  }
  function limpiarFiltrosHistorial(){
    ['h-search','h-tipo','h-estado','h-desde','h-hasta'].forEach(function(id){ document.getElementById(id).value=''; });
    cargarHistorial();
  }

  /** Detalle: GET /api/dte/:id en el modal de F3 */
  function verDte(id){
    return api.dte.obtener(id).then(function(det){ mostrarResultadoDte(det, det); }).catch(alertaError);
  }
  /** Tras una operación: refresca listado y stock, y muestra el detalle actualizado */
  function trasOperacion(id){
    cargarProductos(); contarContingencia();
    if(document.getElementById('v-historial').style.display!=='none') cargarHistorial();
    return id ? verDte(id) : null;
  }

  /* --- Reintentar (CONTINGENCIA) --- */
  function reintentarDte(id){
    var sim = simularDe('h-simular');
    toast('Reintentando envío a MH...');
    api.dte.reintentar(id, sim).then(function(r){
      toast(r.estado==='PROCESADO' ? 'DTE procesado · sello recibido' :
            r.estado==='CONTINGENCIA' ? 'MH sigue sin responder; queda en contingencia' : 'MH rechazó el documento',
            r.estado==='PROCESADO' ? undefined : 'warn');
      return trasOperacion(id);
    }).catch(alertaError);
  }

  /* --- Anular (invalidación) --- */
  var anularId = null;
  function abrirAnular(id){
    var d = dtes.filter(function(x){return x.id===id})[0] || (ultimaEmision && ultimaEmision.emision.id===id ? ultimaEmision.emision : null);
    anularId = id;
    document.getElementById('an-doc').textContent = d ? d.numeroControl : ('DTE #'+id);
    document.getElementById('an-motivo').value = '';
    closeDteResult();
    document.getElementById('anular-modal').classList.add('show');
    setTimeout(function(){ document.getElementById('an-motivo').focus(); }, 50);
  }
  function closeAnular(){ document.getElementById('anular-modal').classList.remove('show'); }
  function confirmarAnular(){
    var motivo = document.getElementById('an-motivo').value.trim();
    if(!motivo){ toast('Escribe el motivo de la anulación','warn'); return; }
    var btn = document.getElementById('an-ok'); btn.disabled = true;
    var id = anularId;
    api.dte.invalidar(id, { tipoAnulacion:2, motivo:motivo }, simularDe('h-simular')).then(function(r){
      closeAnular();
      if(r.estadoEvento==='PROCESADO') toast('DTE anulado · sello del evento recibido');
      else toast('MH rechazó el evento de invalidación; el DTE sigue vigente','warn');
      return trasOperacion(id);
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }

  /* --- Nota de crédito (05) sobre un 03 PROCESADO --- */
  var ncCcf = null;
  function abrirNotaCredito(id){
    api.dte.obtener(id).then(function(det){
      if(det.tipoDte!=='03' || det.estado!=='PROCESADO'){ toast('Solo se acredita un CCF 03 en estado PROCESADO','warn'); return; }
      ncCcf = det;
      document.getElementById('nc-doc').textContent = det.numeroControl;
      document.getElementById('nc-receptor').textContent = det.cliente ? det.cliente.nombre : '—';
      var algo = det.items.some(function(it){ return it.pendiente>0; });
      document.getElementById('nc-tbody').innerHTML = det.items.map(function(it, i){
        return '<tr><td>'+_h(it.codigo)+'</td><td class="prod-name">'+_h(it.descripcion)+'</td>'+
          '<td class="num">'+it.cantidad+'</td><td class="num">'+(it.acreditada||0)+'</td><td class="num">'+it.pendiente+'</td>'+
          '<td class="num">'+money(it.precioUni)+'</td>'+
          '<td class="num"><input class="nc-qty" type="number" min="0" step="1" max="'+it.pendiente+'" value="0" data-i="'+i+'"'+(it.pendiente>0?'':' disabled')+' oninput="calcularNc()"></td></tr>';
      }).join('');
      document.getElementById('nc-sin-pendiente').style.display = algo ? 'none' : '';
      document.getElementById('nc-ok').disabled = !algo;
      calcularNc();
      closeDteResult();
      document.getElementById('nc-modal').classList.add('show');
    }).catch(alertaError);
  }
  function closeNotaCredito(){ document.getElementById('nc-modal').classList.remove('show'); }
  function itemsNc(){
    var out = [], error = null;
    document.querySelectorAll('#nc-tbody .nc-qty').forEach(function(inp){
      var it = ncCcf.items[+inp.getAttribute('data-i')];
      var v = inp.value==='' ? 0 : Number(inp.value);
      if(!Number.isInteger(v) || v<0) error = 'Cantidad inválida para '+it.codigo;
      else if(v>it.pendiente) error = 'La cantidad de '+it.codigo+' supera la pendiente ('+it.pendiente+')';
      else if(v>0) out.push({ productoId:it.productoId, cantidad:v, _pu:it.precioUni });
    });
    return { items:out, error:error };
  }
  /** Estimado: precio unitario del CCF × cantidad + 13 % (la API prorratea descuentos) */
  function calcularNc(){
    var r = itemsNc();
    var sub = r.items.reduce(function(s,x){ return s + _cent(x._pu)*x.cantidad; }, 0)/100;
    var iva = r2(sub*0.13);
    document.getElementById('nc-subtotal').textContent = money(sub);
    document.getElementById('nc-iva').textContent = money(iva);
    document.getElementById('nc-total').textContent = money(r2(sub+iva));
  }
  function confirmarNotaCredito(){
    var r = itemsNc();
    if(r.error){ toast(r.error,'warn'); return; }
    if(r.items.length===0){ toast('Indica al menos una cantidad a acreditar','warn'); return; }
    var btn = document.getElementById('nc-ok'); btn.disabled = true;
    var payload = { dteRelacionadoId: ncCcf.id, items: r.items.map(function(x){ return { productoId:x.productoId, cantidad:x.cantidad }; }) };
    api.dte.notaCredito(payload, simularDe('h-simular')).then(function(emision){
      closeNotaCredito();
      return trasOperacion(emision.id);
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }

  /* ===== Contingencia: lotes (evento de contingencia + recepción por lote) — C1/C2 ===== */
  var ctPendientes = [], ctEventos = [], ctProg = null, ctConsultas = null;
  var TIPO_CONTINGENCIA = { 1:'No disponibilidad de sistema del MH', 2:'No disponibilidad de sistema del emisor',
    3:'Falla en el servicio de Internet del emisor', 4:'Falla en el suministro de energía eléctrica del emisor', 5:'Otro' };
  var ORIGEN_LOTE = { AUTOMATICO:'<span class="st st-draft">⏰ Automático</span>', MANUAL:'<span class="st st-active">✋ Manual</span>' };
  var RESULTADO_LOTE = { PROCESADO:'Enviado', RECHAZADO:'Evento rechazado por MH', SIN_PENDIENTES:'Sin DTE pendientes',
    SIN_RESPUESTA:'MH no respondió', ERROR:'Error' };
  /** Badges de la cola: menú lateral (POS y Administración), tarjeta de Usuarios y KPI del panel gerencial */
  function actualizarColaContingencia(n){
    var b = document.getElementById('cq-badge'); if(b) b.textContent = n+' '+(n===1?'pendiente':'pendientes');
    var k = document.getElementById('kpi-contingencia'); if(k) k.textContent = n;
    ['sb-ct-badge','sb-ct-badge-admin'].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent = n>0 ? n : ''; });
  }
  function contarContingencia(){
    if(!esAdmin()) return Promise.resolve();
    return api.dte.listar({ estado:'CONTINGENCIA' }).then(function(l){ actualizarColaContingencia(l.length); }, function(){});
  }
  function irAContingencia(){ setPanelById('admin','a-contingencia'); }
  function cargarContingencia(silencioso){
    return Promise.all([api.dte.listar({ estado:'CONTINGENCIA' }), api.contingencia.listar(), api.contingencia.programacion(), api.contingencia.consultas()]).then(function(r){
      ctPendientes = r[0].slice().reverse(); // más antiguo primero (orden del detalleDTE)
      ctEventos = r[1];
      ctProg = r[2];
      ctConsultas = r[3];
      renderContingencia();
    }).catch(silencioso ? function(){} : alertaError);
  }
  /** Tiempo desde la emisión ("3 h 20 min"); más de 24 h = fuera del plazo para reportarlo */
  function antiguedad(fecha){
    var min = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 60000));
    var txt = min < 60 ? min+' min' : Math.floor(min/60)+' h '+(min%60)+' min';
    return min >= 1440 ? '<span class="ct-vencido" title="Más de 24 horas sin reportar">⚠ '+txt+'</span>' : txt;
  }
  function renderProgramacion(){
    var p = ctProg;
    document.getElementById('lp-estado').innerHTML = !p ? '' : p.activo
      ? '<span class="st st-sealed">Activo · '+_h(p.hora)+'</span>' : '<span class="st st-draft">Desactivado</span>';
    var act = document.getElementById('lp-activo'), hora = document.getElementById('lp-hora');
    if(p){ if(!act.dataset.dirty) act.checked = p.activo; if(!hora.dataset.dirty && hora!==document.activeElement) hora.value = p.hora; }
    act.disabled = hora.disabled = !esAdmin();
    document.getElementById('lp-proximo').textContent = p && p.proximaEjecucion
      ? fmtFechaHora(p.proximaEjecucion)+(ctPendientes.length ? ' · '+ctPendientes.length+' DTE en cola' : ' · sin DTE en cola')
      : (p ? 'Envío automático desactivado' : '—');
    var u = p && p.ultimaEjecucion;
    document.getElementById('lp-ultimo').innerHTML = !u ? '<span class="muted">Aún no se ha ejecutado</span>'
      : fmtFechaHora(u.fecha)+' · '+_h(RESULTADO_LOTE[u.resultado]||u.resultado)+
        (u.cantidad ? ' ('+u.cantidad+' DTE)' : '')+
        (u.eventoId ? ' · <a href="#" class="link" onclick="verEventoContingencia('+u.eventoId+');return false">Ver lote</a>' : '');
  }
  function renderContingencia(){
    var tb = document.getElementById('ct-tbody');
    if(!tb) return;
    if(ctPendientes.length===0){
      tb.innerHTML = '<tr><td colspan="8"><div class="empty" style="padding:22px"><div class="ic">✅</div>No hay DTE en contingencia</div></td></tr>';
    } else {
      var enCola = {}; ((ctConsultas && ctConsultas.cola) || []).forEach(function(c){ enCola[c.id] = c; });
      tb.innerHTML = ctPendientes.map(function(d){
        return '<tr><td>'+fmtFechaHora(d.fechaEmision)+'</td>'+
          '<td><a href="#" class="link mono-sm" onclick="verDte('+d.id+');return false" title="Ver detalle">'+_h(d.numeroControl)+'</a></td>'+
          '<td>'+(TIPO_DTE[d.tipoDte]||d.tipoDte)+'</td><td>'+_h(d.receptor||'Consumidor final')+'</td>'+
          '<td>'+antiguedad(d.fechaEmision)+'</td>'+
          '<td>'+celdaConsulta(enCola[d.id])+'</td>'+
          '<td class="num">'+money(d.total)+'</td>'+
          '<td class="num"><div class="row-actions"><button class="btn-mini" onclick="consultarMhDte('+d.id+',true)" title="Consultar en MH si sí lo recibió">Consultar</button>'+
          '<button class="btn-mini" onclick="reintentarDesdeContingencia('+d.id+')" title="Reenviar solo este DTE">Reintentar</button></div></td></tr>';
      }).join('');
    }
    var btn = document.getElementById('ct-enviar');
    btn.disabled = ctPendientes.length===0;
    btn.textContent = ctPendientes.length ? '📦 Enviar lote ahora ('+ctPendientes.length+' DTE)' : '📦 Enviar lote ahora';
    document.getElementById('ct-count').textContent = ctPendientes.length+' '+(ctPendientes.length===1?'documento':'documentos');
    actualizarColaContingencia(ctPendientes.length);
    renderProgramacion();
    renderConsultas();

    var te = document.getElementById('ce-tbody');
    te.innerHTML = ctEventos.length===0
      ? '<tr><td colspan="8"><div class="empty" style="padding:22px">Aún no se ha enviado ningún lote</div></td></tr>'
      : ctEventos.map(function(e){
          return '<tr><td>'+fmtFechaHora(e.fecha)+'</td><td>'+(ORIGEN_LOTE[e.origen]||_h(e.origen||'MANUAL'))+'</td>'+
            '<td class="mono-sm">'+(e.codigoLote ? _h(e.codigoLote) : '<span class="muted">— sin lote —</span>')+'</td><td class="num">'+e.cantidad+'</td>'+
            '<td class="small">'+fmtFechaHora(e.fInicio)+' – '+fmtFechaHora(e.fFin)+'</td><td>'+_h(e.usuario)+'</td>'+
            '<td>'+resultadoBadge(e.estado)+'</td>'+
            '<td class="num"><button class="btn-mini" onclick="verEventoContingencia('+e.id+')">Ver</button></td></tr>';
        }).join('');
    document.getElementById('ce-count').textContent = ctEventos.length+' '+(ctEventos.length===1?'lote':'lotes');
  }
  /* --- C3: cola de consultas a MH (un DTE por turno) --- */
  var RESULTADO_CONSULTA = { ENCONTRADO:'Encontrado en MH', NO_ENCONTRADO:'No está en MH', SIN_RESPUESTA:'MH no respondió', ERROR:'Error' };
  /** Celda "Consulta MH" de la cola: turno, veces consultado y último resultado */
  function celdaConsulta(c){
    if(!c) return '<span class="muted">—</span>';
    var turno = c.posicion===1 ? '<span class="st st-pending">Siguiente</span>' : '<span class="muted">Turno '+c.posicion+'</span>';
    var det = c.consultas
      ? c.consultas+(c.consultas===1?' consulta':' consultas')+' · '+_h(RESULTADO_CONSULTA[c.resultado]||c.resultado||'')
      : 'Sin consultar';
    return '<div class="cm-cell">'+turno+'<br><span class="muted">'+det+'</span></div>';
  }
  function renderConsultas(){
    var c = ctConsultas;
    document.getElementById('cm-estado').innerHTML = !c ? '' : c.activo
      ? '<span class="st st-sealed">Activa · cada '+c.intervaloSeg+' s</span>' : '<span class="st st-draft">Desactivada</span>';
    var act = document.getElementById('cm-activo'), iv = document.getElementById('cm-intervalo');
    if(c){ if(!act.dataset.dirty) act.checked = c.activo; if(!iv.dataset.dirty && iv!==document.activeElement) iv.value = c.intervaloSeg; }
    act.disabled = iv.disabled = !esAdmin();
    var prox = '—';
    if(c && !c.activo) prox = 'Consultas automáticas desactivadas';
    else if(c && c.proximaConsulta){
      var seg = Math.max(0, Math.round((new Date(c.proximaConsulta).getTime() - Date.now())/1000));
      var sig = c.cola && c.cola[0];
      prox = (sig ? _h(sig.numeroControl) : 'Sin DTE en cola')+' · en '+(seg < 120 ? seg+' s' : Math.round(seg/60)+' min');
    }
    document.getElementById('cm-proxima').innerHTML = prox;
    var u = c && c.ultimaConsulta;
    document.getElementById('cm-ultima').innerHTML = !u ? '<span class="muted">Aún no hay consultas automáticas</span>'
      : fmtFechaHora(u.fecha)+' · '+(u.dteId ? '<a href="#" class="link mono-sm" onclick="verDte('+u.dteId+');return false">'+_h(u.numeroControl)+'</a> → ' : '')+
        _h(RESULTADO_CONSULTA[u.resultado]||u.resultado);
  }
  function guardarConsultas(){
    var iv = Number(document.getElementById('cm-intervalo').value);
    if(!(iv>=10 && iv<=3600 && iv%1===0)){ toast('El intervalo debe ser un entero entre 10 y 3600 segundos','warn'); return; }
    var btn = document.getElementById('cm-guardar'); btn.disabled = true;
    api.contingencia.configurarConsultas({ activo: document.getElementById('cm-activo').checked, intervaloSeg: iv }).then(function(c){
      delete document.getElementById('cm-activo').dataset.dirty; delete document.getElementById('cm-intervalo').dataset.dirty;
      ctConsultas = c; renderConsultas();
      toast(c.activo ? 'Cola de consultas: un documento cada '+c.intervaloSeg+' s' : 'Cola de consultas desactivada');
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }
  /** Consulta puntual en MH. desdePanel: refresca el panel de contingencia; si no, abre el detalle (Transacciones). */
  function consultarMhDte(id, desdePanel){
    var sim = simularDe(desdePanel ? 'ct-simular' : 'h-simular');
    toast('Consultando el documento en MH...');
    api.dte.consultar(id, sim).then(function(r){
      toast(r.resultado==='ENCONTRADO' ? 'MH sí lo había recibido · DTE aceptado con su sello' :
            r.resultado==='NO_ENCONTRADO' ? 'MH no tiene el documento: es una contingencia real' : 'MH no respondió a la consulta',
            r.resultado==='ENCONTRADO' ? undefined : 'warn');
      if(desdePanel){ contarContingencia(); return cargarContingencia(); }
      return trasOperacion(id);
    }).catch(function(e){
      // p. ej. 409: la cola automática ya lo resolvió → refrescar para no mostrar datos viejos
      alertaError(e);
      return desdePanel ? cargarContingencia(true) : trasOperacion(null);
    });
  }
  /** Mientras el panel de contingencia está abierto se refresca solo (la cola y el lote corren en el servidor) */
  setInterval(function(){
    if(!usuarioActual || !esAdmin()) return;
    var panel = document.getElementById('a-contingencia');
    var visible = panel && panel.style.display!=='none' && document.getElementById('app-admin').classList.contains('active');
    if(visible && !document.getElementById('dte-result-modal').classList.contains('show')) cargarContingencia(true);
    else if(!visible) contarContingencia();
  }, 10000);
  function guardarProgramacion(){
    var hora = document.getElementById('lp-hora').value;
    if(!/^\d{2}:\d{2}$/.test(hora)){ toast('Indica la hora del cierre (HH:mm)','warn'); return; }
    var btn = document.getElementById('lp-guardar'); btn.disabled = true;
    api.contingencia.programar({ activo: document.getElementById('lp-activo').checked, hora: hora }).then(function(p){
      delete document.getElementById('lp-activo').dataset.dirty; delete document.getElementById('lp-hora').dataset.dirty;
      ctProg = p; renderProgramacion();
      toast(p.activo ? 'Lote automático programado a las '+p.hora : 'Lote automático desactivado');
    }).catch(alertaError).then(function(){ btn.disabled = false; });
  }
  /** Lote manual: evento de contingencia con TODOS los DTE pendientes en este momento → recepción por lote */
  function enviarLoteContingencia(){
    if(ctPendientes.length===0){ toast('No hay DTE en contingencia','warn'); return; }
    var motivo = document.getElementById('ct-motivo').value.trim();
    var body = {}; if(motivo) body.motivo = motivo;
    var btn = document.getElementById('ct-enviar');
    btn.disabled = true; btn.textContent = 'Enviando lote a MH...';
    api.contingencia.enviar(body, simularDe('ct-simular')).then(function(ev){
      if(ev.estado==='PROCESADO'){
        var ok = ev.dtes.filter(function(d){ return d.estado==='PROCESADO'; }).length;
        toast('Lote enviado · '+ok+' de '+ev.cantidad+' DTE transmitidos y sellados');
      } else toast('MH rechazó el evento; los DTE siguen en contingencia','warn');
      document.getElementById('ct-motivo').value = '';
      return cargarContingencia().then(function(){ mostrarEventoContingencia(ev); });
    }).catch(function(e){ alertaError(e); return cargarContingencia(); });
  }
  /** Reintento individual desde la cola (POST /api/dte/:id/reintentar) */
  function reintentarDesdeContingencia(id){
    api.dte.reintentar(id, simularDe('ct-simular')).then(function(r){
      toast(r.estado==='PROCESADO' ? 'DTE procesado · sello recibido' :
            r.estado==='CONTINGENCIA' ? 'MH sigue sin responder; queda en contingencia' : 'MH rechazó el documento',
            r.estado==='PROCESADO' ? undefined : 'warn');
      cargarProductos();
      return cargarContingencia();
    }).catch(function(e){ alertaError(e); return cargarContingencia(true); });
  }
  function verEventoContingencia(id){
    return api.contingencia.obtener(id).then(mostrarEventoContingencia).catch(alertaError);
  }
  /** Detalle del lote en el modal de resultado (pestañas: JSON del evento / firmador + MH + lote) */
  function mostrarEventoContingencia(ev){
    var acept = ev.estado==='PROCESADO';
    function fila(k, v, mono){ return '<div class="dr-row"><span>'+k+'</span><b'+(mono?' class="mono"':'')+'>'+v+'</b></div>'; }
    document.getElementById('dr-title').textContent = 'Lote de contingencia';
    document.getElementById('dr-estado').innerHTML = '<span class="dr-badge dr-'+(acept?'ok':'err')+'">'+_h(ev.estado)+'</span>'+
      (ORIGEN_LOTE[ev.origen]||'')+
      '<span class="muted small">'+(acept ? 'MH aceptó el evento y recibió el lote de DTE' : 'MH rechazó el evento; los DTE siguen en contingencia')+'</span>';
    var obs = (ev.respuestaMh && ev.respuestaMh.observaciones) || [];
    var lote = ev.lote;
    document.getElementById('dr-datos').innerHTML =
      fila('Código de generación (evento)', _h(ev.codigoGeneracion), true) +
      fila('Sello del evento', ev.selloRecibido ? _h(ev.selloRecibido) : '<span class="muted">— sin sello —</span>', true) +
      fila('Código de lote', lote ? _h(lote.codigoLote) : '<span class="muted">— no se envió lote —</span>', true) +
      (lote ? fila('Resultado del lote', lote.procesados+' procesados · '+lote.rechazados+' rechazados') : '') +
      fila('Fecha de envío', fmtFechaHora(ev.fecha)) +
      fila('Período de contingencia', fmtFechaHora(ev.fInicio)+' – '+fmtFechaHora(ev.fFin)) +
      fila('Tipo de contingencia', ev.tipoContingencia+' · '+_h(TIPO_CONTINGENCIA[ev.tipoContingencia]||'')) +
      fila('Motivo', ev.motivo ? _h(ev.motivo) : '<span class="muted">—</span>') +
      fila('Enviado por', _h(ev.usuario||'—')) +
      (ev.respuestaMh ? fila('Mensaje MH', _h(ev.respuestaMh.codigoMsg+' · '+ev.respuestaMh.descripcionMsg)) : '') +
      (obs.length ? fila('Observaciones', obs.map(_h).join('<br>')) : '') +
      fila('DTE ('+ev.dtes.length+')', ev.dtes.map(function(d){
        return '<div style="display:flex;align-items:center;gap:8px;margin:2px 0">'+
          '<a href="#" class="link mono-sm" onclick="verDte('+d.id+');return false">'+_h(d.numeroControl)+'</a>'+estadoBadge(d.estado)+'</div>';
      }).join(''));
    document.getElementById('dr-tab-json').textContent = 'JSON evento';
    document.getElementById('dr-json').textContent = JSON.stringify(ev.jsonEvento, null, 2);
    document.getElementById('dr-mh').textContent = JSON.stringify({
      firmador: ev.firmador, respuestaMh: ev.respuestaMh,
      lote: lote ? { jsonLote: lote.jsonLote, respuestaMh: lote.respuestaMh } : null
    }, null, 2);
    document.getElementById('dr-acciones').innerHTML = '';
    drTab('json');
    document.getElementById('dte-result-modal').classList.add('show');
  }

  /* ===== Bitácora contra GET /api/bitacora (F4) ===== */
  var bitacora = [];
  function cargarBitacora(){
    var f = {
      accion: document.getElementById('b-accion').value,
      usuario: document.getElementById('b-usuario').value.trim(),
      desde: document.getElementById('b-desde').value,
      hasta: document.getElementById('b-hasta').value,
      limite: 500
    };
    return api.bitacora(f).then(function(lista){ bitacora = lista; renderBitacora(); }).catch(alertaError);
  }
  var _bitTimer;
  function cargarBitacoraDiferido(){ clearTimeout(_bitTimer); _bitTimer = setTimeout(cargarBitacora, 300); }
  function resultadoBadge(r){
    if(!r) return '<span class="muted">—</span>';
    var cls = r==='PROCESADO' ? 'st-sealed' : r==='CONTINGENCIA' ? 'st-pending' : 'st-rejected';
    return '<span class="st '+cls+'">'+_h(r)+'</span>';
  }
  function renderBitacora(){
    var tb = document.getElementById('b-tbody');
    if(!tb) return;
    if(bitacora.length===0){
      tb.innerHTML = '<tr><td colspan="6"><div class="empty" style="padding:22px">Sin eventos</div></td></tr>';
    } else {
      tb.innerHTML = bitacora.map(function(b){
        var ent = b.entidad ? _h(b.entidad)+(b.entidadId!=null?' #'+b.entidadId:'') : '—';
        return '<tr><td>'+fmtFechaHora(b.fecha)+'</td><td>'+_h(b.usuario||'—')+'</td><td><b>'+_h(b.accion)+'</b></td>'+
          '<td>'+ent+'</td><td>'+resultadoBadge(b.resultado)+'</td><td class="small">'+_h(b.detalle||'')+'</td></tr>';
      }).join('');
    }
    document.getElementById('b-count').textContent = bitacora.length+' eventos';
  }
  function exportarBitacoraCsv(){
    if(bitacora.length===0){ toast('No hay eventos para exportar','warn'); return; }
    var cols = ['id','fecha','usuario','accion','entidad','entidadId','dteId','codigoGeneracion','resultado','detalle'];
    function cel(v){ v = v==null ? '' : String(v); return /[",;\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
    var csv = '﻿' + cols.join(',') + '\r\n' + bitacora.map(function(b){ return cols.map(function(c){ return cel(b[c]); }).join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    a.download = 'bitacora-'+ymd(new Date())+'.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    toast('Bitácora exportada ('+bitacora.length+' eventos)');
  }

  function uuidGen(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){
      var r=Math.random()*16|0, v=(c==='x')?r:(r&0x3|0x8); return v.toString(16);
    }).toUpperCase();
  }
  function randCode(n){ var s='', c='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; for(var i=0;i<n;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
  function fmtFecha(ymdStr){ var p=ymdStr.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

  var EMISOR = {nombre:'Comercial Atlacatl, S.A. de C.V.', nit:'0614-120589-102-3', nrc:'123456-7', actividad:'Venta al por menor', correo:'facturacion@comercialatlacatl.sv', comercial:'Comercial Atlacatl', telefono:'2222-3344', direccion:'Antiguo Cuscatlán, La Libertad'};
  var currentSale = null, currentMeta = null;

  function randTime(){ function p(x){return x<10?'0'+x:''+x;} return p(8+Math.floor(Math.random()*9))+':'+p(Math.floor(Math.random()*60))+':'+p(Math.floor(Math.random()*60)); }
  function fauxQr(size){
    var n=21, cell=size/n, r, c, rects='';
    function finder(fx,fy){
      return '<rect x="'+(fx*cell)+'" y="'+(fy*cell)+'" width="'+(7*cell)+'" height="'+(7*cell)+'" fill="#000"/>'+
             '<rect x="'+((fx+1)*cell)+'" y="'+((fy+1)*cell)+'" width="'+(5*cell)+'" height="'+(5*cell)+'" fill="#fff"/>'+
             '<rect x="'+((fx+2)*cell)+'" y="'+((fy+2)*cell)+'" width="'+(3*cell)+'" height="'+(3*cell)+'" fill="#000"/>';
    }
    for(r=0;r<n;r++){ for(c=0;c<n;c++){
      if((r<8&&c<8)||(r<8&&c>n-9)||(r>n-9&&c<8)) continue;
      if(Math.random()>0.5) rects+='<rect x="'+(c*cell)+'" y="'+(r*cell)+'" width="'+cell+'" height="'+cell+'" fill="#000"/>';
    }}
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" xmlns="http://www.w3.org/2000/svg"><rect width="'+size+'" height="'+size+'" fill="#fff"/>'+rects+finder(0,0)+finder(n-7,0)+finder(0,n-7)+'</svg>';
  }
  function enteroALetras(n){
    if(n===0) return 'cero';
    var UNI=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte'];
    var DEC=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
    var CEN=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
    function tres(x){
      if(x===100) return 'cien';
      var cc=Math.floor(x/100), dd=x%100, d=Math.floor(dd/10), u=dd%10, s='';
      if(cc>0) s+=CEN[cc]+' ';
      if(dd<=20) s+=UNI[dd];
      else if(dd<30) s+='veinti'+UNI[u];
      else { s+=DEC[d]; if(u>0) s+=' y '+UNI[u]; }
      return s.trim();
    }
    var s='', mill=Math.floor(n/1000000), miles=Math.floor((n%1000000)/1000), resto=n%1000;
    if(mill>0) s+=(mill===1?'un millón':tres(mill)+' millones')+' ';
    if(miles>0) s+=(miles===1?'mil':tres(miles)+' mil')+' ';
    if(resto>0) s+=tres(resto);
    return s.trim();
  }
  function numeroALetras(num){
    num = Math.round(num*100)/100;
    var ent=Math.floor(num), cent=Math.round((num-ent)*100);
    return (enteroALetras(ent)+' DÓLARES CON '+(cent<10?'0'+cent:cent)+'/100').toUpperCase();
  }
  function mrow(th,td){ return '<tr><th>'+th+'</th><td>'+td+'</td></tr>'; }
  function prow(th,td){ return '<tr><th>'+th+'</th><td>'+(td||'&nbsp;')+'</td></tr>'; }
  function trow(label,val){ return '<div class="row"><span>'+label+'</span><b>'+val+'</b></div>'; }

  function buildDteHtml(){
    var s=currentSale, m=currentMeta, es01=m.es01;
    var gravTotal = es01 ? s.total : (s.total/1.13);
    var iva = es01 ? 0 : (s.total - gravTotal);
    var p1 = Math.round(gravTotal*0.6*100)/100;
    var p2 = Math.round((gravTotal-p1)*100)/100;
    var items=[
      {n:1, cod:'ART-014', cant:2, uni:'Unidad', desc:'Bicicleta de montaña 26"', pu:Math.round(p1/2*100)/100, grav:p1},
      {n:2, cod:'ART-027', cant:1, uni:'Unidad', desc:'Accesorios y repuestos',    pu:p2,                       grav:p2}
    ];
    var itemRows = items.map(function(it){
      return '<tr><td>'+it.n+'</td><td>'+it.cod+'</td><td>'+it.cant+'</td><td>'+it.uni+'</td><td>'+it.desc+'</td>'+
        '<td class="num">'+money(it.pu)+'</td><td class="num">$0.00</td><td class="num">$0.00</td><td class="num">$0.00</td><td class="num">'+money(it.grav)+'</td></tr>';
    }).join('');
    var recNit = (s.documento && s.documento!=='—') ? s.documento : '';
    var totals = trow('Sumatoria de ventas', money(gravTotal))+
      trow('Monto global Desc., Rebajas y otros a ventas no sujetas','$0.00')+
      trow('Monto global Desc., Rebajas y otros a ventas exentas','$0.00')+
      trow('Monto global de Desc., Rebajas y otros a ventas gravadas','$0.00')+
      trow('Sub-Total', money(gravTotal))+
      (es01 ? '' : trow('IVA (13%)', money(iva)))+
      trow('IVA Percibido','$0.00')+
      trow('IVA Retenido','$0.00')+
      trow('Retención Renta','$0.00')+
      trow('Monto Total de la Operación', money(s.total))+
      trow('Total Otros montos no afectos','$0.00')+
      '<div class="row total"><span>Total a pagar</span><b>'+money(s.total)+'</b></div>';
    return '<div class="dte2">'+
      '<div class="dte2-top"><div class="dte2-qr">'+m.qr+'</div>'+
        '<div><div class="dte2-title">DOCUMENTO TRIBUTARIO ELECTRÓNICO</div><div class="dte2-subtitle">'+(es01?'FACTURA':'COMPROBANTE DE CRÉDITO FISCAL')+'</div></div></div>'+
      '<table class="dte2-meta">'+
        mrow('Código de Generación', m.codgen)+
        mrow('Número de Control', m.numctrl)+
        mrow('Sello de recibido', '<span class="mono">'+m.sello+'</span>')+
        mrow('Modelo de Facturación','Modelo Facturación previo')+
        mrow('Tipo de Transmisión','Transmisión normal')+
        mrow('Fecha y Hora de Generación', m.fechaHora)+
      '</table>'+
      '<div class="dte2-parties">'+
        '<div class="dte2-party"><div class="dte2-party-h">EMISOR</div><table>'+
          prow('Nombre o razón social',EMISOR.nombre)+prow('NIT',EMISOR.nit)+prow('NRC',EMISOR.nrc)+
          prow('Actividad Económica',EMISOR.actividad)+prow('Correo electrónico',EMISOR.correo)+
          prow('Nombre Comercial',EMISOR.comercial)+prow('Teléfono',EMISOR.telefono)+prow('Dirección',EMISOR.direccion)+
        '</table></div>'+
        '<div class="dte2-party"><div class="dte2-party-h">RECEPTOR</div><table>'+
          prow('Nombre o razón social',s.cliente)+prow('NIT',recNit)+prow('NRC','')+
          prow('Actividad Económica','')+prow('Correo electrónico','')+
          prow('Nombre Comercial',s.cliente)+prow('Teléfono','')+prow('Dirección','')+
        '</table></div>'+
      '</div>'+
      '<div class="dte2-itemswrap"><table class="dte2-items"><thead><tr>'+
        '<th>N°</th><th>Código</th><th>Cant</th><th>Unidad</th><th>Descripción</th>'+
        '<th class="num">Precio Unitario</th><th class="num">Descuento</th><th class="num">Ventas No Suj.</th><th class="num">Ventas Exentas</th><th class="num">Ventas Gravadas</th>'+
        '</tr></thead><tbody>'+itemRows+'</tbody></table></div>'+
      '<div class="dte2-bottom">'+
        '<div class="dte2-obs"><div class="dte2-obs-h">OBSERVACIONES</div><div class="dte2-obs-body"></div>'+
          '<table class="dte2-cond"><tr><th>Condición de la operación</th><td>Contado</td></tr>'+
          '<tr><th>Valor en Letras</th><td>'+numeroALetras(s.total)+'</td></tr></table>'+
        '</div>'+
        '<div class="dte2-totals">'+totals+'</div>'+
      '</div>'+
    '</div>';
  }
  var emailTargetId = null; // id del DTE para GET /api/dte/:id/pdf
  function openEmailModal(dte, id){
    emailTargetDte = dte;
    emailTargetId = id || null;
    document.getElementById('email-dte').textContent = dte;
    document.getElementById('email-input').value = '';
    document.getElementById('email-modal').classList.add('show');
    setTimeout(function(){ document.getElementById('email-input').focus(); }, 50);
  }
  function closeEmailModal(){ document.getElementById('email-modal').classList.remove('show'); }
  function sendEmail(){
    var v = document.getElementById('email-input').value.trim();
    if(!v || v.indexOf('@')===-1 || v.indexOf('.')===-1){ toast('Ingresa un correo válido','warn'); return; }
    closeEmailModal();
    toast('DTE '+emailTargetDte+' enviado a '+v);
  }

  function buildPrintHtml(){
    var fname = 'DTE-'+(emailTargetDte||'').replace('#','');
    var css = '@page{margin:12mm}'+
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
      'body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a}'+
      '.dte2{font-size:11px}.dte2 table{width:100%;border-collapse:collapse}'+
      '.dte2-top{display:flex;gap:14px;align-items:center;padding:0 0 12px}'+
      '.dte2-qr{flex-shrink:0;border:1px solid #ccc;padding:4px;line-height:0}'+
      '.dte2-title{font-size:13px;font-weight:bold}'+
      '.dte2-subtitle{font-size:14px;font-weight:bold;color:#1a5d96;margin-top:2px}'+
      '.dte2-meta th{width:34%;text-align:left;background:#0e2640;color:#fff;font-size:10px;font-weight:bold;padding:6px 10px;border:1px solid #0e2640}'+
      '.dte2-meta td{font-size:10px;padding:6px 10px;border:1px solid #d9dee6;word-break:break-all}'+
      '.dte2-parties{display:grid;grid-template-columns:1fr 1fr;margin-top:10px}'+
      '.dte2-party-h{background:#0e2640;color:#fff;text-align:center;font-size:11px;font-weight:bold;padding:6px;border:1px solid #0e2640}'+
      '.dte2-party th{width:34%;text-align:left;background:#eef1f5;font-size:9px;font-weight:bold;padding:5px 8px;border:1px solid #d9dee6;vertical-align:top}'+
      '.dte2-party td{font-size:9.5px;padding:5px 8px;border:1px solid #d9dee6}'+
      '.dte2-itemswrap{margin-top:10px}'+
      '.dte2-items th{background:#0e2640;color:#fff;font-size:8.5px;font-weight:bold;padding:6px;border:1px solid #0e2640;text-align:left}'+
      '.dte2-items td{font-size:9.5px;padding:6px;border:1px solid #d9dee6}'+
      '.dte2-items .num{text-align:right}'+
      '.dte2-bottom{display:grid;grid-template-columns:1fr 1fr;margin-top:10px}'+
      '.dte2-obs-h{background:#0e2640;color:#fff;text-align:center;font-size:11px;font-weight:bold;padding:6px;border:1px solid #0e2640}'+
      '.dte2-obs-body{min-height:80px;border:1px solid #d9dee6}'+
      '.dte2-cond th{background:#eef1f5;text-align:left;font-size:9px;padding:5px 8px;border:1px solid #d9dee6;width:48%}'+
      '.dte2-cond td{font-size:9.5px;padding:5px 8px;border:1px solid #d9dee6}'+
      '.dte2-totals .row{display:flex;justify-content:space-between;gap:10px;font-size:9.5px;padding:5px 10px;border:1px solid #d9dee6;border-top:none}'+
      '.dte2-totals .row:first-child{border-top:1px solid #d9dee6}'+
      '.dte2-totals .row span{color:#555}.dte2-totals .row b{font-weight:bold}'+
      '.dte2-totals .row.total{background:#0e2640;color:#fff;font-size:12px;font-weight:bold;border-color:#0e2640}'+
      '.dte2-totals .row.total span,.dte2-totals .row.total b{color:#fff}'+
      '.mono{font-family:monospace}';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+fname+'</title><style>'+css+'</style></head><body>'+ buildDteHtml() +'</body></html>';
  }
  /* PDF real del DTE (GET /api/dte/:id/pdf, misma plantilla del ejemplo).
     En modo mock (o sin id) se descarga el PDF de ejemplo de js/pdf-data.js. */
  function downloadPdf(){
    if(emailTargetId && !API_CONFIG.USE_MOCK){
      api.dte.pdf(emailTargetId).then(function(blob){
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (emailTargetDte||'DTE')+'.pdf';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
        toast('PDF descargado');
      }, function(e){ toast((e && e.message) || 'No se pudo generar el PDF','warn'); });
      return;
    }
    try{
      var bin = atob(PDF_DATA);
      var bytes = new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      var blob = new Blob([bytes], {type:'application/pdf'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'DTE-'+(emailTargetDte||'').replace('#','')+'.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      toast('PDF descargado');
    }catch(e){ toast('No se pudo generar el PDF','warn'); }
  }

  renderInventory(); renderCart(); renderCatalog(''); renderClientForm(); renderClientes();
  // F2: restaurar la sesión guardada (el token se valida en la primera llamada a la API)
  if(api.isLoggedIn() && api.getUsuario()) iniciarSesion(api.getUsuario());
  renderHistorial(); renderBitacora();

  function toggleSidebar(role){
    var sb = document.getElementById('sb-'+role);
    var open = sb.classList.toggle('open');
    document.getElementById('scrim').classList.toggle('show', open);
  }
  function closeSidebars(){
    document.querySelectorAll('.sidebar').forEach(function(s){s.classList.remove('open')});
    document.getElementById('scrim').classList.remove('show');
  }

  var toastTimer;
  function toast(msg, type){
    var t = document.getElementById('toast');
    var icon = document.getElementById('toast-icon');
    if(type==='warn'){ icon.className='tick warn'; icon.textContent='!'; }
    else { icon.className='tick'; icon.textContent='✓'; }
    document.getElementById('toast-msg').textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){t.classList.remove('show')},2600);
  }
