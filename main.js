(function() {

var nil_ops = {
  "NOP"  : "0",
  "HALT" : "1"
};

var mem_ops = {
  "LB" : "0010",
  "SB" : "0100"
};

var imm_ops = {
  "ADDI" : "0101",
  "ORI"  : "0111",
  "ANDI" : "0110",

  "BEQ"  : "1000",
  "BNE"  : "1001"
};

var rtype_funcs = {
  "ADD" : "000", 
  "SUB" : "001",
  "SRA" : "010",
  "SRL" : "011",
  "SLL" : "100",
  "AND" : "101",
  "OR"  : "110"
};

var branch_one = {
  "BGEZ" : "1010",
  "BLTZ" : "1011"
};

function rem_whitespace(str) {
  return str.replace(/\s+|\t+/g, ' ');
}

// Extract the bytecode for a single instruction [instr].
function bytecode(instr, line) {
  // Throw an error message and exit the program.
  function error(msg) {
    throw "Parse error" + (line || line === 0 ? " on line " + (line + 1) : "") + ": " + msg; 
  }
  // Get x from a string like "Rx"
  function reg_num(str) {
    var n = parseInt(str.replace(/R/g, ''), 10);
    if (n < 0 || n > 7) {
      error("Invalid register number.");
    }
    return num_to_bin(n, 3);
  }
  // Get the sign-extended 6-bit immediate value from str
  function imm_num(str) {
    if (!str.match(/^-?\d+/)) {
      error("Invalid immediate value.");
    }
    var n = parseInt(str, 10);
    if (n < -32 || n > 31) {
      error("Immediate value exceeds 6-bit representable range.");
    }
    return num_to_bin(n, 6);
  }
  // Convert [num] to a 2's complement binary number with length [bits].
  function num_to_bin(num, bits) {
    compl = num < 0;
    num = Math.abs(num);
    var bin = "";
    var mask = 1;
    for (var i = 0; i < bits; i++) {
      bin = (num & mask ? "1" : "0") + bin;
      mask <<= 1;
    }
    if (compl) {
      r = bin.match(/(.*)(10*)$/);
      inv = r[1].replace(/0/g, 'T')
                .replace(/1/g, '0')
                .replace(/T/g, '1');
      bin = inv + r[2];
    }
    return bin;
  }
  instr = rem_whitespace($.trim(instr.replace(/,+/g, '').replace(/\(|\)/g, ' ').toUpperCase()));
  var toks = instr.split(' ');
  console.log(toks);
  var op = toks[0];
  // "Nil"-type instructions
  var n_func = nil_ops[op];
  if (n_func) {
    return num_to_bin(0, 15) + n_func;
  }
  // Immediate-type instructions
  var i_op = imm_ops[op];
  var rs, rt, rd, imm;
  if (i_op) {
    if (toks.length == 4) {
      rt = reg_num(toks[1]);
      rs = reg_num(toks[2]);
      imm = imm_num(toks[3]);
    } else if (toks.length == 3) {
      rs = reg_num(toks[1]);
      rt = "000";
      imm = imm_num(toks[2]);
    } else {
      error("Invalid imm. instruction format");
    }
    return i_op + rs + rt + imm;
  }
  // R-Type instructions
  var func = rtype_funcs[op];
  if (func) {
    rd = reg_num(toks[1]);
    rs = reg_num(toks[2]);
    rt = toks[3] ? (reg_num(toks[3])) : "000";
    return "1111" + rs + rt + rd + func;
  }
  // Memory instructions
  var m_op = mem_ops[op];
  if (m_op) {
    rt = reg_num(toks[1]);
    imm = imm_num(toks[2]);
    rs = reg_num(toks[3]);
    return m_op + rs + rt + imm;
  }
  // Branch (single register) instructions
  var b_op = branch_one[op];
  if (b_op) {
    rs = reg_num(toks[1]);
    imm = imm_num(toks[2]);
    rt = "000";
    return b_op + rs + rt + imm;
  }
  error("Invalid instruction type.");
}

function parse_all() {
  var start = parseInt($('#start').val(), 10) || 0;
  var offs = 0;
  function process(instr, i) {
    if (instr == "") {
      --offs;
      return "\n";
    }
    return "mem[" + (i + start + offs) + "] <= 16'b" + bytecode(instr, i) + 
            "; // " + $.trim(instr) + '\n';
  }
  var instrs = $('#instructions').val().split('\n');
  $('#verilog').val('');
  try {
    results = $.map(instrs, process);
    console.log(results);
    $(results).each(function(_, res) {
      $('#verilog').val($('#verilog').val() + res);
    });
  } catch (error) {
    $('#verilog').val('There was an error processing your code:\n' + error);
  }
}

function num_validate(e) {
  var evt = e || window.event;
  var key = evt.keyCode || evt.which;
  key = String.fromCharCode( key );
  var regex = /[0-9]/;
  if( !regex.test(key) ) {
    evt.returnValue = false;
    if(evt.preventDefault) {
      evt.preventDefault();
    }
  }
}

$(document).ready(function() {
  $('#start').keypress(num_validate);
  $('#convert').click(parse_all);
});

})();