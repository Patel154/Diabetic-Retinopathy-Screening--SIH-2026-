function build_workflow
% Simple fluid queue approximation, units = patients/day. Not a discrete-event simulation.
root=fileparts(fileparts(mfilename('fullpath'))); name='DR_telemedicine';
if bdIsLoaded(name),close_system(name,0);end
new_system(name); open_system(name);
add_block('simulink/Sources/Constant',[name '/Arrivals'],'Value','400','Position',[30 50 100 80]);
% capacity = min(upload, inference, reviewer), assumes all cases reviewed.
add_block('simulink/Sources/Constant',[name '/Capacity'],'Value','min([480 600 360])','Position',[30 130 100 160]);
add_block('simulink/Math Operations/Sum',[name '/Net arrivals'],'Inputs','+-','Position',[160 60 185 100]);
add_block('simulink/Continuous/Integrator',[name '/Backlog'],'LimitOutput','on','LowerSaturationLimit','0','UpperSaturationLimit','inf','InitialCondition','0','Position',[250 60 280 100]);
add_block('simulink/Sinks/Scope',[name '/Queue'],'Position',[350 60 380 100]);
add_line(name,'Arrivals/1','Net arrivals/1');add_line(name,'Capacity/1','Net arrivals/2');add_line(name,'Net arrivals/1','Backlog/1');add_line(name,'Backlog/1','Queue/1');
set_param(name,'StopTime','250');save_system(name,fullfile(root,'models',[name '.slx']));
fprintf('400/day × 250 days = 100,000 arrivals; baseline capacity 360/day gives 10,000 backlog. Edit capacity and simulate.\n');
end
